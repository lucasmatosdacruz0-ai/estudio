import { GoogleGenAI, Type, Modality, GenerateContentResponse } from "@google/genai";
import { state, components } from "../state";

if (!process.env.API_KEY) {
    throw new Error("API_KEY environment variable not set");
}
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// --- Retry Logic ---
const MAX_RETRIES = 2; // 1 initial attempt + 2 retries
const RETRY_DELAY_MS = 3000;

async function retryableApiCall<T>(
    apiFn: () => Promise<T>,
    signal?: AbortSignal
): Promise<T> {
    let lastError: Error | undefined;
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        if (signal?.aborted) {
            // Use a specific error message for cancellation
            const abortError = new Error("Operação cancelada pelo utilizador.");
            abortError.name = 'AbortError';
            throw abortError;
        }
        try {
            return await apiFn();
        } catch (error) {
            lastError = error as Error;
            // Don't retry if it was a user cancellation
            if (lastError.name === 'AbortError') {
                throw lastError;
            }
            if (attempt < MAX_RETRIES) {
                console.warn(`API call failed on attempt ${attempt + 1}. Retrying in ${RETRY_DELAY_MS / 1000}s...`, error);
                await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
            }
        }
    }
    console.error("API call failed after all retries.", lastError);
    throw new Error(`A chamada à API falhou após ${MAX_RETRIES + 1} tentativas. Erro final: ${lastError?.message || 'Erro desconhecido'}`);
}


// --- Helper Functions ---

async function createOutpaintingImage(baseImageBase64: string, newFormat: string): Promise<string> {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = (e) => reject(new Error("Falha ao carregar a imagem base para outpainting."));
        image.src = `data:image/png;base64,${baseImageBase64}`;
    });

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error("Não foi possível criar o contexto do canvas");

    const [targetWidthRatio, targetHeightRatio] = newFormat.split(':').map(Number);
    
    // Use a fixed high resolution for the canvas to ensure quality
    const maxDimension = 1024;
    let canvasWidth: number;
    let canvasHeight: number;

    if (targetWidthRatio > targetHeightRatio) {
        canvasWidth = maxDimension;
        canvasHeight = Math.round(maxDimension * (targetHeightRatio / targetWidthRatio));
    } else {
        canvasHeight = maxDimension;
        canvasWidth = Math.round(maxDimension * (targetWidthRatio / targetHeightRatio));
    }

    canvas.width = canvasWidth;
    canvas.height = canvasHeight;

    // Calculate the dimensions to draw the image, preserving its aspect ratio
    const imageAspectRatio = img.naturalWidth / img.naturalHeight;
    const canvasAspectRatio = canvas.width / canvas.height;
    
    let drawWidth, drawHeight;
    if (imageAspectRatio > canvasAspectRatio) {
        // Image is wider than canvas aspect ratio, so fit to width
        drawWidth = canvas.width;
        drawHeight = drawWidth / imageAspectRatio;
    } else {
        // Image is taller or same aspect ratio, so fit to height
        drawHeight = canvas.height;
        drawWidth = drawHeight * imageAspectRatio;
    }

    // Calculate position to center the image
    const x = (canvas.width - drawWidth) / 2;
    const y = (canvas.height - drawHeight) / 2;
    
    // Fill the background with black
    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Draw the original image in the center
    ctx.drawImage(img, x, y, drawWidth, drawHeight);

    return canvas.toDataURL('image/png').split(',')[1];
}



// --- API Calls ---

export async function callGenerateDescriptivePromptAPI() {
    const model = 'gemini-2.5-flash';
    const instruction = "Aja como uma diretora de arte. Crie uma descrição para um gerador de imagens. Preencha criativamente os detalhes em falta para criar uma cena completa e coesa. A descrição final deve ser uma única narrativa coesa.";
    const parts: any[] = [{ text: instruction }];

    if (state.ref.image) {
        parts.push({ text: `\n[Referência de Estilo]: A imagem a seguir é a referência principal para o estilo visual, iluminação, esquema de cores e composição geral. A cena descrita deve corresponder de perto a esta estética.` });
        parts.push({ inlineData: { mimeType: "image/jpeg", data: state.ref.image } });
    }

    Object.keys(components).forEach(id => {
        if (id === 'ref') return; // Skip ref as it's handled above
        if (state[id].image || state[id].text.trim()) {
            let descriptionText = `\n[${components[id].title}]: ${state[id].text.trim() || 'Conforme a imagem.'}`;
            if (['cloth', 'acc', 'prod'].includes(id) && state[id].image) {
                descriptionText += " Extraia APENAS o item (roupa, acessório ou produto) desta imagem para aplicar na cena, ignorando qualquer pessoa ou fundo complexo na imagem de referência.";
            }
            parts.push({ text: descriptionText });
            if (state[id].image) {
                parts.push({ inlineData: { mimeType: "image/jpeg", data: state[id].image } });
            }
        }
    });
    
    const response: GenerateContentResponse = await retryableApiCall(() => ai.models.generateContent({
        model: model,
        contents: { parts: parts }
    }));

    if (!response.text) {
        console.error("API response missing text:", JSON.stringify(response, null, 2));
        throw new Error("A IA não retornou uma descrição de texto válida.");
    }
    return response.text;
}

export async function callEnhancePromptAPI(userPrompt: string) {
    const model = 'gemini-2.5-flash';
    const instruction = `Você é um assistente de prompt para uma IA de geração de imagens. Melhore o seguinte pedido do utilizador para ser mais descritivo e vívido, sem alterar a intenção principal. Responda apenas com o prompt melhorado. Pedido do utilizador: "${userPrompt}"`;
    
    const response: GenerateContentResponse = await retryableApiCall(() => ai.models.generateContent({
        model: model,
        contents: { parts: [{ text: instruction }] }
    }));

    if (!response.text) {
        console.warn("IA de melhoria de prompt não retornou texto, a usar o prompt original.");
        return userPrompt; // Fallback to original prompt
    }
    return response.text.trim();
}

export async function callImprovePromptAPI(prompt: string) {
    if (!prompt.trim()) {
        return "";
    }
    const model = 'gemini-2.5-flash';
    const instruction = `Aja como um especialista em engenharia de prompts para IAs de geração de imagem. Melhore o prompt do utilizador para ser mais vívido, detalhado e eficaz, mantendo a intenção original. Adicione detalhes sobre iluminação, composição e estilo artístico que se alinhem com o tema. Responda apenas com o prompt melhorado, sem qualquer outro texto introdutório. Prompt do utilizador: "${prompt}"`;
    
    const response: GenerateContentResponse = await retryableApiCall(() => ai.models.generateContent({
        model: model,
        contents: { parts: [{ text: instruction }] }
    }));

    if (!response.text) {
        console.warn("IA de melhoria de prompt não retornou texto, a usar o prompt original.");
        return prompt;
    }
    return response.text.trim();
}

export async function callImproveTextForImageAPI(userText: string, sceneDescription: string) {
    if (!userText.trim()) {
        return "";
    }
    const model = 'gemini-2.5-flash';
    const instruction = `Você é um designer gráfico profissional especializado em tipografia e publicidade.
Sua tarefa é transformar um texto simples do usuário em uma instrução detalhada e profissional para uma IA de geração de imagem.
Analise o texto do usuário e o contexto da cena para criar uma sugestão que seja visualmente atraente e coesa.

**Contexto da Cena:** "${sceneDescription}"
**Texto do Usuário:** "${userText}"

Reescreva o texto do usuário para ser uma instrução completa. Especifique o estilo da fonte (ex: 'fonte serifada elegante', 'sans-serif em negrito', 'script manuscrito divertido'), a cor, e o posicionamento (ex: 'canto inferior direito', 'centralizado no topo', 'integrado à cena').

Responda APENAS com a instrução de texto aprimorada.`;
    
    const response: GenerateContentResponse = await retryableApiCall(() => ai.models.generateContent({
        model: model,
        contents: { parts: [{ text: instruction }] }
    }));

    if (!response.text) {
        console.warn("IA de melhoria de texto não retornou resultado, usando o texto original.");
        return userText;
    }
    return response.text.trim();
}


export async function callStructurePromptAPI(prompt: string) {
    if (!prompt.trim()) {
        throw new Error("O prompt está vazio.");
    }
    const model = 'gemini-2.5-flash';
    const instruction = `Analise o seguinte prompt para geração de imagem e decomponha-o nos seus componentes principais. Se um componente não for mencionado, deixe o campo vazio. Prompt: "${prompt}"`;

    const schema = {
        type: Type.OBJECT,
        properties: {
            subject: { type: Type.STRING, description: "O sujeito ou personagem principal da imagem." },
            action: { type: Type.STRING, description: "A ação que o sujeito está a realizar." },
            setting: { type: Type.STRING, description: "O cenário, localização ou fundo." },
            style: { type: Type.STRING, description: "O estilo artístico ou visual (ex: fotorrealista, cartoon, pintura a óleo, cyberpunk)." },
            composition: { type: Type.STRING, description: "Detalhes sobre o enquadramento e a composição (ex: close-up, plano geral, visto de baixo)." },
            lighting: { type: Type.STRING, description: "Descrição da iluminação (ex: luz do entardecer, iluminação de estúdio, néon)." },
            colors: { type: Type.STRING, description: "A paleta de cores principal ou o ambiente de cor." }
        },
        required: ["subject", "action", "setting", "style", "composition", "lighting", "colors"]
    };

    const response: GenerateContentResponse = await retryableApiCall(() => ai.models.generateContent({
        model: model,
        contents: { parts: [{ text: instruction }] },
        config: {
            responseMimeType: "application/json",
            responseSchema: schema
        }
    }));

    if (!response.text) {
        throw new Error("Não foi possível estruturar o prompt.");
    }
    return JSON.parse(response.text);
}


export async function callSuggestEditsAPI(prompt: string) {
    const model = 'gemini-2.5-flash';
    const instruction = `Com base na seguinte descrição: "${prompt}", sugira 3 edições criativas. Responda apenas com uma lista separada por novas linhas.`;
    
    const response: GenerateContentResponse = await retryableApiCall(() => ai.models.generateContent({
        model: model,
        contents: { parts: [{ text: instruction }] }
    }));

    if (!response.text) {
        throw new Error("Não foi possível obter sugestões da IA.");
    }
    return response.text.split('\n').filter(s => s.trim());
}

export async function callGenerateFinalImageAPI(
    fullPrompt: string, 
    generationParams: {
        style: string,
        intention: string,
        framing: string,
        negativePrompt: string,
        pose: string
    },
    options: any = {},
    signal?: AbortSignal
) {
    const model = 'gemini-2.5-flash-image';
    let prompt = fullPrompt;

    if (options.isFinalTake) {
        prompt = `**INSTRUÇÃO PRINCIPAL: O seu único objetivo é gerar UMA ÚNICA imagem que represente o FRAME FINAL do roteiro de vídeo abaixo.**
        NÃO recrie a imagem inicial. Crie uma nova imagem que mostre o culminar da ação descrita.
        Use a imagem inicial e os componentes de referência APENAS para manter a consistência visual (rosto do personagem, roupas, estilo, cenário).

        **ROTEIRO DO VÍDEO:**
        ${fullPrompt}`;
    }

    const parts: any[] = [{ text: prompt }];
    
    const simpleImages = state.simpleImages.filter(img => img);
    const usingSimpleMode = simpleImages.length > 0;

    if (usingSimpleMode) {
        parts.push({ text: `\n[Referências Visuais Gerais]: Use as seguintes imagens como inspiração visual para o prompt.` });
        simpleImages.forEach(imgData => {
            parts.push({ inlineData: { mimeType: "image/jpeg", data: imgData } });
        });
    } else {
        // Advanced Mode Logic
        if (state.ref.image) {
            parts.push({ text: `\n[Referência de Estilo Principal]: Use esta imagem como a principal inspiração para o estilo artístico, iluminação e atmosfera.` });
            parts.push({ inlineData: { mimeType: "image/jpeg", data: state.ref.image } });
        }

        // Handle locked character
        if (options.lockedCharacterImage) {
            parts.push({ text: '\n[PERSONAGEM FIXO]: Mantenha a identidade facial desta pessoa.' });
            parts.push({ inlineData: { mimeType: "image/png", data: options.lockedCharacterImage } });
        }

        // Handle image references
        if (state.newChar.image && options.baseImageForVariation) {
            parts.push({ text: '\n[IMAGEM BASE]: Mantenha a composição, pose e roupas desta imagem.' });
            parts.push({ inlineData: { mimeType: "image/png", data: options.baseImageForVariation } });
            parts.push({ text: '\n[NOVO PERSONAGEM]: Aplique o rosto/identidade desta pessoa na imagem base.' });
            parts.push({ inlineData: { mimeType: "image/jpeg", data: state.newChar.image } });
            state.newChar.image = null; 
        } else if (options.isVariation && options.baseImageForVariation) {
            // Se for uma mudança de formato, prepare a imagem para outpainting
            if (options.newFormat) {
                const outpaintingImage = await createOutpaintingImage(options.baseImageForVariation, options.newFormat);
                
                // Modificar o prompt principal para focar no outpainting
                const outpaintingInstruction = `\n**INSTRUÇÃO OBRIGATória DE OUTPAINTING (PREENCHIMENTO):** A imagem de referência fornecida tem bordas pretas. A sua única tarefa é preencher criativamente as áreas pretas, expandindo a cena da imagem central para preencher todo o enquadramento. NÃO altere o conteúdo da imagem original. Mantenha exatamente o mesmo estilo, iluminação e assunto. O resultado final deve ser uma imagem maior e completa, sem NENHUMA borda preta.`;
                
                // Adicionar a instrução ao prompt principal
                parts[0].text = fullPrompt + outpaintingInstruction;

                // Enviar a imagem composta para outpainting
                parts.push({ inlineData: { mimeType: "image/png", data: outpaintingImage } });
            } else {
                // Para outras variações (sem mudança de formato), usar a imagem base como está
                parts.push({ text: '\n[Imagem base para variação ou edição]' });
                parts.push({ inlineData: { mimeType: "image/png", data: options.baseImageForVariation } });
            }
            
            // Adicionar imagens de edição rápida se existirem (para qualquer tipo de variação)
            if (options.quickEditImages && options.quickEditImages.length > 0) {
                parts.push({ text: `\n[Referências Visuais Adicionais para Edição]: Use estas imagens como inspiração adicional para a alteração solicitada no prompt.` });
                options.quickEditImages.forEach(imgData => {
                    parts.push({ inlineData: { mimeType: "image/jpeg", data: imgData } });
                });
            }
        } else { // This block now handles initial generation AND final take
            if (options.isFinalTake && options.baseImageForVariation) {
                const instruction = `\n[IMAGEM INICIAL DE REFERÊNCIA]: Esta é a cena inicial. Use-a APENAS para manter a consistência visual.`;
                parts.push({ text: instruction });
                parts.push({ inlineData: { mimeType: "image/png", data: options.baseImageForVariation } });
            }

            // Add component images for initial generation AND final take to ensure detail consistency
             ['char', 'bg', 'cloth', 'acc', 'prod'].forEach(id => {
                if (state[id].image) {
                    if (id === 'char' && options.lockedCharacterImage) {
                        return;
                    }
            
                    let instructionText = `\n[Referência para ${components[id].title.split(' ')[0]}]`;
                    
                    if (id === 'char') {
                        instructionText = `\n[Referência do Personagem]: Use APENAS as características faciais e físicas da pessoa nesta imagem. A cena, a pose, a roupa e o fundo devem ser determinados pelo prompt principal. IGNORE o fundo, a roupa e a pose desta imagem de referência.`;
                    } else if (['cloth', 'acc', 'prod'].includes(id)) {
                        instructionText = `\n[Use APENAS o item (roupa, acessório, produto) desta imagem de referência e ignore a pessoa que a veste]`;
                    }
                    
                    parts.push({ text: instructionText });
                    parts.push({ inlineData: { mimeType: "image/jpeg", data: state[id].image } });
                }
            });
        }
    }
    
    if (state.pose.image) {
        parts.push({ text: '\n[Referência para a Pose]' });
        parts.push({ inlineData: { mimeType: "image/jpeg", data: state.pose.image } });
        state.pose.image = null;
    }

    // Handle inpainting mask
    if (options.inpaintingMask) {
        parts.push({ text: '\n[MÁSCARA DE EDIÇÃO]: Altere apenas a área branca da máscara.' });
        parts.push({ inlineData: { mimeType: "image/png", data: options.inpaintingMask } });
    }

    const MAX_NO_IMAGE_RETRIES = 4;
    for (let attempt = 0; attempt <= MAX_NO_IMAGE_RETRIES; attempt++) {
        const response: GenerateContentResponse = await retryableApiCall(() => ai.models.generateContent({
            model: model,
            contents: { parts: parts },
            config: {
                responseModalities: [Modality.IMAGE],
            },
            signal: signal
        }), signal);

        const imagePart = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData);

        if (imagePart) {
            return imagePart.inlineData.data; // Success
        }
        
        const finishReason = response.candidates?.[0]?.finishReason;
        if (finishReason === 'NO_IMAGE') {
            if (attempt < MAX_NO_IMAGE_RETRIES) {
                console.warn(`API retornou NO_IMAGE na tentativa ${attempt + 1}. A tentar novamente...`);
                continue; // Try again
            } else {
                // All NO_IMAGE retries failed, throw the user-friendly error
                throw new Error("A imagem não pôde ser gerada, provavelmente devido às políticas de segurança. Por favor, ajuste o seu prompt ou as imagens de referência.");
            }
        }
        
        // Handle other errors where there's no image
        const textPart = response.candidates?.[0]?.content?.parts?.find(p => p.text)?.text;
        console.error("API response missing image:", JSON.stringify(response, null, 2));
        if (textPart) {
            throw new Error(`A IA retornou um texto em vez de uma imagem: "${textPart}"`);
        }
        throw new Error("A resposta da API não continha dados de imagem.");
    }

    // Fallback error, should not be reached
    throw new Error("Não foi possível gerar a imagem após todas as tentativas.");
}

export async function callGenerateConceptAPI(theme: string, image: string | null, characterType: string) {
    const model = 'gemini-2.5-flash';
    let instruction = `Aja como uma especialista em marketing digital e social media para o Instagram, focada em e-commerce de moda. O seu público são lojistas e influenciadores. Crie um conceito para um post de Instagram que seja comercial, atraente e que gere vendas.`;

    if (theme) instruction += ` O tema, produto ou campanha é: "${theme}".`;

    instruction += ` O tipo de personagem para a foto é: ${characterType}. Se for "sem personagem", foque em um flat lay, still de produto ou um cenário que conte uma história sobre o produto.`;

    if (image) instruction += " Use a imagem de referência como inspiração visual principal.";

    instruction += `\nGere descrições concisas e inspiradoras para os seguintes componentes, prontas para serem usadas na criação de uma imagem de alta conversão:
- Personagem: ${characterType === 'sem personagem' ? 'Não aplicável.' : `Descreva o modelo (${characterType}) e o estilo, focando na persona do cliente ideal.`}
- Cenário: Sugira um fundo que valorize o produto (ex: estúdio com fundo de cor, cena urbana, ambiente de lifestyle).
- Roupa: Detalhe o look principal da postagem. Se não houver personagem, descreva como a roupa seria apresentada (ex: em um cabide, dobrada).
- Acessório: Sugira um acessório que complemente o look.
- Produto: Descreva um produto específico que está sendo promovido (pode ser a roupa, o acessório ou outro item).`;


    const parts: any[] = [{ text: instruction }];
    if (image) {
        parts.push({ inlineData: { mimeType: "image/jpeg", data: image } });
    }

    const schema = {
        type: Type.OBJECT,
        properties: {
            char: { type: Type.STRING, description: "Descrição do personagem." },
            bg: { type: Type.STRING, description: "Descrição do cenário." },
            cloth: { type: Type.STRING, description: "Descrição da roupa." },
            acc: { type: Type.STRING, description: "Descrição do acessório." },
            prod: { type: Type.STRING, description: "Descrição de um produto." }
        },
        required: ["char", "bg", "cloth", "acc", "prod"]
    };

    const response: GenerateContentResponse = await retryableApiCall(() => ai.models.generateContent({
        model: model,
        contents: { parts: parts },
        config: {
            responseMimeType: "application/json",
            responseSchema: schema
        }
    }));

    if (!response.text) {
        throw new Error("Não foi possível gerar o conceito. Tente um tema diferente.");
    }
    return JSON.parse(response.text);
}

export async function callGenerateCaptionAPI(prompt: string) {
    const model = 'gemini-2.5-flash';
    const instruction = `Você é um gestor de redes sociais para uma marca de moda. Com base na seguinte descrição de uma imagem: "${prompt}", escreva 3 legendas cativantes para o Instagram. Inclua emojis e hashtags relevantes.`;

    const schema = {
        type: Type.OBJECT,
        properties: {
            captions: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: 'Uma lista de 3 sugestões de legendas.'
            }
        },
        required: ["captions"]
    };

    const response: GenerateContentResponse = await retryableApiCall(() => ai.models.generateContent({
        model: model,
        contents: { parts: [{ text: instruction }] },
        config: {
            responseMimeType: "application/json",
            responseSchema: schema
        }
    }));

    if (!response.text) {
        throw new Error("Não foi possível gerar legendas.");
    }
    const result = JSON.parse(response.text);
    return result.captions;
}

interface VideoScriptContext {
    basePrompt: string;
    char: string;
    cloth: string;
    bg: string;
    acc: string;
    intention: string;
    initialImageBase64: string;
    duration: string;
    style: string;
}

export async function callGenerateVideoScriptAPI(context: VideoScriptContext) {
    const model = 'gemini-2.5-flash';
    const instruction = `Aja como um roteirista profissional e criador de prompts para a Veo, a IA de geração de vídeo do Google.
Sua tarefa é criar um roteiro de vídeo coeso e lógico que sirva como uma continuação direta da imagem e do contexto fornecidos.

**Contexto Inicial:**
- **Descrição da Cena Principal:** ${context.basePrompt || 'Não fornecida.'}
- **Personagem:** ${context.char || 'Conforme a imagem.'}
- **Roupa:** ${context.cloth || 'Conforme a imagem.'}
- **Cenário:** ${context.bg || 'Conforme a imagem.'}
- **Acessório:** ${context.acc || 'Conforme a imagem.'}
- **Intenção da Campanha:** ${context.intention}

**Imagem Inicial (Ponto de Partida OBRIGATÓRIO):**
A imagem fornecida é o primeiro frame do vídeo. O roteiro DEVE começar exatamente nesta cena, com este personagem, roupa e cenário.

**Instruções para o Roteiro:**
1.  **Continuidade Estrita:** NÃO invente um novo personagem, mude de roupa ou de cenário. O vídeo deve mostrar o que acontece a seguir nesta cena. Baseie-se em todo o contexto fornecido para criar uma narrativa que faça sentido.
2.  **Duração:** O vídeo completo deve ter ${context.duration} segundos.
3.  **Estilo da Cena:** O estilo de filmagem deve ser: "${context.style}".
4.  **Roteiro (Prompt para Veo):** Crie um prompt detalhado em inglês para a IA de vídeo. Descreva a ação que se desenrola a partir da imagem inicial, de forma cinematográfica, culminando numa cena final. O prompt deve ser rico em detalhes visuais e honrar todo o contexto fornecido.
5.  **Diálogo:** Se o roteiro incluir diálogos, especifique que a fala é em "português do Brasil" e inclua a fala exata entre aspas. Exemplo: a man says in Brazilian Portuguese, "Este é o segredo."

Responda em JSON com "portuguese_summary" (um resumo em português do que acontece na cena) e "english_script" (o prompt em inglês para a IA de vídeo).`;

    const schema = {
        type: Type.OBJECT,
        properties: {
            portuguese_summary: { type: Type.STRING, description: "Resumo em português da cena." },
            english_script: { type: Type.STRING, description: "Roteiro em inglês para a IA de vídeo." }
        },
        required: ["portuguese_summary", "english_script"]
    };

    const parts: any[] = [
        { text: instruction },
        { inlineData: { mimeType: "image/png", data: context.initialImageBase64 } }
    ];

     const response: GenerateContentResponse = await retryableApiCall(() => ai.models.generateContent({
        model: model,
        contents: { parts: parts },
        config: {
            responseMimeType: "application/json",
            responseSchema: schema
        }
    }));
    if (!response.text) {
        throw new Error("Não foi possível gerar o roteiro.");
    }
    return JSON.parse(response.text);
}