import { GoogleGenAI, Type, Modality } from "@google/genai";
import { state, components } from "../state";

if (!process.env.API_KEY) {
    throw new Error("API_KEY environment variable not set");
}
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

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

    const response = await ai.models.generateContent({
        model: model,
        contents: { parts: parts }
    });

    if (!response.text) {
        console.error("API response missing text:", JSON.stringify(response, null, 2));
        throw new Error("A IA não retornou uma descrição de texto válida.");
    }
    return response.text;
}

export async function callSuggestEditsAPI(prompt: string) {
    const model = 'gemini-2.5-flash';
    const instruction = `Com base na seguinte descrição: "${prompt}", sugira 3 edições criativas. Responda apenas com uma lista separada por novas linhas.`;
    
    const response = await ai.models.generateContent({
        model: model,
        contents: { parts: [{ text: instruction }] }
    });

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
    options: any = {}
) {
    const model = 'gemini-2.5-flash-image';
    let prompt = fullPrompt;

    if (options.editPrompt) prompt += `. APLIQUE A SEGUINTE ALTERAÇÃO: ${options.editPrompt}`;
    if (options.isUpscale) prompt += '. A imagem deve ser 8k, hiper-detalhada, com foco nítido e qualidade profissional.';
    if (generationParams.pose) prompt += `. POSE: ${generationParams.pose}`;

    const parts: any[] = [{ text: prompt }];
    const lastVersion = state.versionHistory[state.versionHistory.length - 1];

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
    if (state.newChar.image && lastVersion) {
        parts.push({ text: '\n[IMAGEM BASE]: Mantenha a composição, pose e roupas desta imagem.' });
        parts.push({ inlineData: { mimeType: "image/png", data: lastVersion.base64 } });
        parts.push({ text: '\n[NOVO PERSONAGEM]: Aplique o rosto/identidade desta pessoa na imagem base.' });
        parts.push({ inlineData: { mimeType: "image/jpeg", data: state.newChar.image } });
        state.newChar.image = null; 
    } else if (options.isVariation && lastVersion) {
        parts.push({ text: '\n[Imagem base para variação ou edição]' });
        parts.push({ inlineData: { mimeType: "image/png", data: lastVersion.base64 } });
    } else if (options.isFinalTake && lastVersion) {
        parts.push({ text: `Com base na imagem inicial, gere o frame final da cena descrita neste roteiro: ${fullPrompt}`});
        parts.push({ inlineData: { mimeType: "image/png", data: lastVersion.base64 } });
    } else {
         ['char', 'bg', 'cloth', 'acc', 'prod'].forEach(id => {
            if (state[id].image && !options.lockedCharacterImage) { // Don't send original char image if locked
                let instructionText = `\n[Referência para ${components[id].title.split(' ')[0]}]`;
                if (['cloth', 'acc', 'prod'].includes(id)) {
                    instructionText = `\n[Use APENAS o item (roupa, acessório, produto) desta imagem de referência e ignore a pessoa que a veste]`;
                }
                parts.push({ text: instructionText });
                parts.push({ inlineData: { mimeType: "image/jpeg", data: state[id].image } });
            }
        });
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

    const response = await ai.models.generateContent({
        model: model,
        contents: { parts: parts },
        config: {
            responseModalities: [Modality.IMAGE, Modality.TEXT],
        },
    });

    const imagePart = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData);

    if (!imagePart) {
        console.error("API response missing image:", JSON.stringify(response, null, 2));
        throw new Error("A resposta da API não continha dados de imagem.");
    }
    return imagePart.inlineData.data;
}

export async function callGenerateConceptAPI(theme: string, image: string | null) {
    const model = 'gemini-2.5-flash';
    let instruction = `Você é um estilista de moda. Crie um conceito de moda completo baseado na seguinte inspiração.`;
    if (theme) instruction += ` O tema principal é: "${theme}".`;
    if (image) instruction += " Use a imagem de referência como inspiração principal para o estilo, cores e atmosfera.";
    instruction += " Forneça descrições concisas para: Personagem, Cenário, Roupa, Acessório e um Produto relacionado ao tema.";
    
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

    const response = await ai.models.generateContent({
        model: model,
        contents: { parts: parts },
        config: {
            responseMimeType: "application/json",
            responseSchema: schema
        }
    });

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
                items: { type: Type.STRING }
            }
        },
        required: ["captions"]
    };

    const response = await ai.models.generateContent({
        model: model,
        contents: { parts: [{ text: instruction }] },
        config: {
            responseMimeType: "application/json",
            responseSchema: schema
        }
    });
    
    if (!response.text) {
        throw new Error("Não foi possível gerar as legendas.");
    }
    return JSON.parse(response.text).captions;
}

export async function callGenerateVideoScriptAPI(imagePrompt: string, duration: string, style: string) {
    const model = 'gemini-2.5-flash';
    const instruction = `Você é um realizador de cinema a criar uma lista de planos para um filme de moda para um gerador de vídeo de IA. O vídeo deve ter ${duration} segundos. A cena principal é descrita como: '${imagePrompt}'. O estilo de câmara pretendido é '${style}'. Gere um roteiro profissional, plano a plano, em INGLÊS. O roteiro deve descrever o que acontece desde o início (representado pela imagem do utilizador) até um novo estado final. Forneça também um resumo de uma frase em PORTUGÊS. O resultado final deve ser um objeto JSON com as chaves 'portuguese_summary' e 'english_script'.`;
    
    const schema = {
        type: Type.OBJECT,
        properties: {
            portuguese_summary: { type: Type.STRING },
            english_script: { type: Type.STRING }
        },
        required: ["portuguese_summary", "english_script"]
    };

    const response = await ai.models.generateContent({
        model: model,
        contents: { parts: [{ text: instruction }] },
        config: {
            responseMimeType: "application/json",
            responseSchema: schema
        }
    });
    
    if (!response.text) {
        throw new Error("Não foi possível gerar o roteiro do vídeo.");
    }
    return JSON.parse(response.text);
}