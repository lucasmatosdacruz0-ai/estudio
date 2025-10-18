import { state, components } from './state';
import * as dom from './dom';
import * as ui from './ui';
import * as sound from './sound';
import * as gemini from './services/geminiService';
import { fileToBase64 } from './utils';

// --- Mode Management ---

function clearAdvancedModeState() {
    Object.keys(components).forEach(id => {
        state[id].image = null;
        state[id].text = '';
        const textarea = dom.getEl(`${id}-textarea`) as HTMLTextAreaElement;
        if (textarea) textarea.value = '';
        ui.clearComponentPreview(id);
    });
    ui.updateComponentLockState();
    ui.updateArtDirectionAccess();
    state.versionHistory = [];
    ui.hideFinalImage();
    ui.renderHistory();
}

function clearSimpleModeState() {
    state.simpleImages = [null, null, null];
    state.quickEditImages = [null, null, null];
    state.quickVersionHistory = [];
    for (let i = 0; i < 3; i++) {
        ui.clearSimpleImagePreview(i);
        ui.clearQuickEditImagePreview(i);
    }
    dom.simplePromptTextarea.value = '';
    dom.quickEditPrompt.value = '';
    state.quickCreationResult = { base64: null, prompt: '' };
    ui.hideQuickFinalImage();
    ui.renderQuickHistory();
    
    // Also clear the main prompt textarea if it was filled by the simple one
    if (state.simpleImages.some(img => img)) {
        dom.promptBaseTextarea.value = '';
        state.basePrompt = '';
    }
}

function switchToSimpleMode() {
    if (state.char.image || state.char.text || state.bg.image || state.bg.text || state.cloth.image || state.cloth.text || state.acc.image || state.acc.text || state.prod.image || state.prod.text) {
        clearAdvancedModeState();
    }
    ui.hideFinalImage();
    ui.updatePostGenerationButtons(false, state.quickCreationResult.base64 != null);
}

function switchToAdvancedMode() {
    if (state.simpleImages.some(img => img) || state.quickCreationResult.base64) {
        clearSimpleModeState();
    }
    ui.hideQuickFinalImage();
    ui.updatePostGenerationButtons(state.versionHistory.length > 0, false);
}


// --- Storage ---
function loadSavedCharacters() {
    const saved = localStorage.getItem('fashion_saved_characters');
    if (saved) {
        try {
            const parsed = JSON.parse(saved);
            if (Array.isArray(parsed)) {
                state.savedCharacters = parsed;
            } else {
                console.warn("Dados de personagens salvos corrompidos (não é um array). A limpar.");
                localStorage.removeItem('fashion_saved_characters');
            }
        } catch (e) {
            console.error("Falha ao analisar os personagens salvos. A limpar dados corrompidos.", e);
            localStorage.removeItem('fashion_saved_characters');
        }
    }
}

function persistSavedCharacters() {
    try {
        const serializedState = JSON.stringify(state.savedCharacters);
        const stateSize = new Blob([serializedState]).size;

        if (stateSize > 4.8 * 1024 * 1024) { // 4.8MB to be safe
            alert("Atenção: A sua biblioteca de personagens está a ficar muito grande e pode não ser salva corretamente. Considere apagar personagens antigos.");
        }

        localStorage.setItem('fashion_saved_characters', serializedState);
    } catch(e) {
        console.error("Erro ao persistir personagens:", e);
        // Re-throw to be caught by handleSaveCharacter
        throw new Error("Não foi possível salvar na memória do navegador. Pode estar cheia ou restrita.");
    }
}

// --- Character Creator & Generation Panel Helpers ---
function clearCharacterCreator() {
    state.char = { image: null, text: '', framing: 'de corpo inteiro' };
    ui.syncCharacterComponentFromState();
    ui.updateArtDirectionAccess();
}

function resetGenerationPanel() {
    // Clear state
    state.versionHistory = [];
    state.basePrompt = '';
    state.lockedCharacterImage = null;
    state.format = '1:1';

    clearSimpleModeState();
    
    // Clear UI
    dom.promptBaseTextarea.value = '';
    dom.addTextInput.value = '';
    dom.negativePromptTextarea.value = 'rosto deformado, mãos deformadas, múltiplos dedos, má qualidade, baixa resolução, arte de IA, gerado por computador, irreal, pouco nítido, desfocado, cartoon, pintura, feio, duplicado, moldura, bordas pretas, barras pretas';
    dom.editPrompt.value = '';
    dom.suggestionsList.innerHTML = '';
    dom.quickEditPrompt.value = '';
    dom.quickSuggestionsList.innerHTML = '';
    dom.quickAddTextInput.value = '';

    ui.hideFinalImage();
    ui.showImagePlaceholder();
    dom.finalImageDisplay.style.aspectRatio = '1';
    ui.renderHistory();
    ui.updatePostGenerationButtons(false, false);
    ui.updateFixCharacterButton();
    
    // Reset selectors
    dom.styleSelector.selectedIndex = 0;
    dom.intentionSelector.selectedIndex = 0;
    dom.poseSelector.selectedIndex = 0;
    (dom.getEl('format-square') as HTMLInputElement).checked = true;
    (dom.getEl('quick-format-square') as HTMLInputElement).checked = true;


    // Hide script section if open
    ui.hideScriptResult();
    dom.finalTakeImage.classList.add('hidden');
}


// --- Character Library Handlers ---
function handleSaveCharacter() {
    if (!state.char.image && !state.char.text.trim()) {
        alert("Não há personagem para salvar.");
        return;
    }
    const defaultName = `Personagem ${new Date().toLocaleDateString()}`;
    ui.openSaveCharacterModal(defaultName);
}

function confirmSaveCharacter() {
    const defaultName = `Personagem ${new Date().toLocaleDateString()}`;
    const characterName = dom.saveCharacterNameInput.value;

    const finalName = characterName.trim() || defaultName;

    const newCharacter = {
        id: `char_${Date.now()}`,
        name: finalName,
        char: JSON.parse(JSON.stringify(state.char)), // Deep copy
        isFavorite: true, // Salvar como favorito por padrão
        isPinned: false,
        timestamp: Date.now()
    };

    state.savedCharacters.unshift(newCharacter); // Adiciona no início para aparecer primeiro
    try {
        persistSavedCharacters();
        ui.closeSaveCharacterModal(); // Fecha o popup de salvar
        rerenderCharacterLibrary();   // Abre a biblioteca para feedback imediato
        clearCharacterCreator();      // Limpa o criador para o próximo personagem
    } catch (e) {
        console.error("Erro ao salvar personagem:", e);
        alert((e as Error).message || "Ocorreu um erro ao salvar o personagem.");
        state.savedCharacters.shift(); // Reverte o estado se a persistência falhar
    }
}

function handleLoadCharacter(id: string) {
    const characterToLoad = state.savedCharacters.find(c => c.id === id);
    if (characterToLoad) {
        // 1. Reinicia todo o painel direito para criar um contexto limpo
        resetGenerationPanel();
        
        // 2. Carrega os dados do personagem no painel esquerdo
        switchToAdvancedMode();
        state.char = JSON.parse(JSON.stringify(characterToLoad.char)); // Deep copy
        ui.syncCharacterComponentFromState();
        ui.updateArtDirectionAccess();
        handleCharacterUpdate(); // Isso irá acionar a geração de prompt, se necessário
        ui.closeCharacterLibraryModal();
    }
}

function handleDeleteCharacter(id: string) {
    if (confirm("Tem certeza que deseja apagar este personagem?")) {
        state.savedCharacters = state.savedCharacters.filter(c => c.id !== id);
        persistSavedCharacters();
        rerenderCharacterLibrary();
    }
}

function handleToggleFavoriteCharacter(id: string) {
    const character = state.savedCharacters.find(c => c.id === id);
    if (character) {
        character.isFavorite = !character.isFavorite;
        persistSavedCharacters();
        rerenderCharacterLibrary();
    }
}

function handleTogglePinCharacter(id: string) {
    const character = state.savedCharacters.find(c => c.id === id);
    if (character) {
        character.isPinned = !character.isPinned;
        persistSavedCharacters();
        rerenderCharacterLibrary();
    }
}

function rerenderCharacterLibrary() {
    ui.openCharacterLibraryModal(state.savedCharacters, {
        onLoad: handleLoadCharacter,
        onDelete: handleDeleteCharacter,
        onToggleFavorite: handleToggleFavoriteCharacter,
        onTogglePin: handleTogglePinCharacter,
    });
}


// --- Handlers ---

function handleRemoveImage(id: string) {
    switchToAdvancedMode();
    state[id].image = null;
    ui.clearComponentPreview(id);

    if (id === 'char') {
        handleCharacterUpdate();
    } else {
        ui.updateComponentLockState();
    }
}


async function handleCharacterUpdate() {
    const charCard = dom.getEl('char-component-card');
    if (charCard) {
        charCard.classList.remove('pulse-once');
    }
    
    ui.updateArtDirectionAccess();
    // No longer auto-generates prompt. User must click the button.
}

async function handleImageUpload(event: Event, id: string) {
    switchToAdvancedMode();
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    // The limit check is now handled by disabling the input via updateComponentLockState
    // No need for an alert here.

    const base64 = await fileToBase64(file);
    state[id].image = base64;
    ui.updateComponentPreview(id, URL.createObjectURL(file));
    
    if (id === 'char') {
        handleCharacterUpdate();
    } else {
        ui.updateArtDirectionAccess();
        ui.updateComponentLockState(); // Update lock state for non-char components
    }
}

function handleTextInput(event: Event, id: string) {
    switchToAdvancedMode();
    const textarea = event.target as HTMLTextAreaElement;
    state[id].text = textarea.value;

    if (id === 'char') {
        handleCharacterUpdate();
    } else {
        ui.updateArtDirectionAccess();
    }
}

async function handleInspirationImageUpload(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    state.inspirationImage = await fileToBase64(file);
    ui.updateInspirationPreview(URL.createObjectURL(file));
    ui.checkInspirationReady();
}

async function generateAndDisplayPrompt() {
    if (state.isGenerating) return;
    switchToAdvancedMode();
    await sound.startAudioContext();
    
    ui.setGenerationState(true);
    const toastId = ui.showToast('A gerar descrição da cena...', 'loading');
    ui.hideError();

    try {
        const descriptivePrompt = await gemini.callGenerateDescriptivePromptAPI();
        state.basePrompt = descriptivePrompt.trim();
        dom.promptBaseTextarea.value = state.basePrompt;
        ui.checkPrompt();
        sound.playSound("C5");
        ui.showToast('Descrição gerada com sucesso!', 'success', 3000);
    } catch (error) {
        const errorMessage = (error as Error).message;
        ui.showToast(errorMessage, 'error', 5000);
        dom.promptBaseTextarea.value = 'Erro ao gerar descrição. Tente novamente.';
    } finally {
        ui.hideToast(toastId);
        ui.setGenerationState(false);
    }
}

async function handleImageGeneration(options: any = {}) {
    if (state.isGenerating) return;
    
    state.generationController = new AbortController();
    const signal = state.generationController.signal;

    await sound.startAudioContext();
    ui.setGenerationState(true);
    const toastId = ui.showToast('A gerar imagem...', 'loading');
    ui.hideError();

    const placeholderFn = options.isQuickMode ? ui.showQuickImagePlaceholder : ui.showImagePlaceholder;

    try {
        const generationParams = {
            style: dom.styleSelector.value,
            intention: dom.intentionSelector.value,
            framing: state.char.framing,
            negativePrompt: dom.negativePromptTextarea.value,
            pose: dom.poseSelector.value
        };

        const format = options.newFormat || state.format;

        let finalPrompt: string;
        
        if (options.isVariation) {
            let basePrompt = options.editPrompt || '';
            const overlayText = (options.isQuickMode ? dom.quickAddTextInput.value : dom.addTextInput.value).trim();
            if (overlayText) {
                basePrompt += `. A imagem DEVE conter o texto EXATO "${overlayText}" renderizado de forma proeminente, clara e estilisticamente apropriada.`;
            }

            if (basePrompt) {
                finalPrompt = `Com base na imagem fornecida, aplique a seguinte alteração: ${basePrompt}`;
            } else if (options.isUpscale) {
                finalPrompt = "Aumente a qualidade e o realismo desta imagem para 8k. Adicione detalhes finos e texturas realistas à pele do personagem, ao tecido das roupas e às superfícies do cenário, como paredes. A iluminação deve ser aprimorada para parecer mais natural e profissional, com foco nítido. Mantenha a composição, pose e todos os elementos da imagem original intactos.";
            } else if (options.newFormat) {
                const sceneDescription = options.isQuickMode ? dom.simplePromptTextarea.value : dom.promptBaseTextarea.value;
                finalPrompt = `Baseado na imagem central fornecida, use a seguinte descrição para completar a cena: "${sceneDescription}".`;
            } else {
                finalPrompt = "Refaça esta imagem, mantendo o estilo e o assunto.";
            }
        } else {
            let sceneDescription = dom.promptBaseTextarea.value;
            if (options.isQuickMode === false && !sceneDescription.trim()){
                 switchToAdvancedMode();
                sceneDescription = await gemini.callGenerateDescriptivePromptAPI();
                state.basePrompt = sceneDescription;
                dom.promptBaseTextarea.value = state.basePrompt;
            }
            
            const overlayText = (options.isQuickMode ? dom.quickAddTextInput.value : dom.addTextInput.value).trim();
            if (overlayText) {
                sceneDescription += `. A imagem DEVE conter o texto EXATO "${overlayText}" renderizado de forma proeminente, clara e estilisticamente apropriada.`;
            }

            let posePrompt = '';
            if (generationParams.pose) {
                posePrompt = ` A pose do personagem deve ser: ${generationParams.pose}.`;
            }
            
            let qualityAndStyle: string;
            let negativePromptContent = generationParams.negativePrompt;

            if (generationParams.intention.includes('UGC')) {
                qualityAndStyle = `Estética de vídeo UGC (Conteúdo Gerado pelo Utilizador) autêntico, gravado com um smartphone de alta qualidade para redes sociais (estilo TikTok/Reels). Iluminação natural e casual (luz de janela, ring light suave). Cenário do dia a dia. Momento espontâneo, não posado. Foco na textura natural da pele e na qualidade realista de uma câmara de smartphone, não em um look de estúdio 8k super polido. IMPORTANTE: A imagem final deve ser limpa, contendo APENAS a cena fotografada. NÃO inclua NENHUM elemento de interface de rede social, como ícones de 'curtir', comentários, nomes de utilizador, hashtags ou barras de tempo.`;
                negativePromptContent += ', interface de utilizador, UI, ícones, texto sobreposto, iluminação de estúdio, pose artificial, super polido, muito perfeito, irreal, fotografia profissional, 8k, alta costura';
            } else {
                qualityAndStyle = `Fotografia ultra-realista com qualidade de câmera profissional, 8k, texturas de pele e tecido visíveis, iluminação natural, indistinguível de uma fotografia real. Estilo visual: ${generationParams.style}.`;
            }

            const composition = `Intenção: ${generationParams.intention}. Enquadramento do personagem: ${generationParams.framing}.${posePrompt} Proporção exata de ${format}, sem bordas.`;
            const negative = `Evite estritamente: ${negativePromptContent}, filtros excessivos, saturação exagerada, visual de "arte de IA".`;

            finalPrompt = `${qualityAndStyle} ${composition} Cena: ${sceneDescription}. ${negative}`;
        }

        const lastAdvancedVersion = state.versionHistory[state.versionHistory.length - 1];

        const apiOptions = {
            ...options,
            lockedCharacterImage: state.lockedCharacterImage,
            baseImageForVariation: options.isQuickMode ? state.quickCreationResult.base64 : lastAdvancedVersion?.base64,
            quickEditImages: options.isQuickMode ? state.quickEditImages.filter(img => img) : []
        };

        const generatedImageBase64 = await gemini.callGenerateFinalImageAPI(finalPrompt, generationParams, apiOptions, signal);
        
        state.format = format;
        const imageUrl = `data:image/png;base64,${generatedImageBase64}`;

        if(options.isQuickMode) {
            const newVersion = { base64: generatedImageBase64, prompt: finalPrompt };
            state.quickVersionHistory.push(newVersion);
            state.quickCreationResult = newVersion;
            ui.displayQuickFinalImage(imageUrl);
            ui.renderQuickHistory();
            dom.quickEditPrompt.value = '';
            ui.updatePostGenerationButtons(false, true);

        } else {
            state.versionHistory.push({ base64: generatedImageBase64, prompt: finalPrompt });
            ui.displayFinalImage(imageUrl);
            dom.editPrompt.value = '';
            ui.renderHistory();
            ui.updatePostGenerationButtons(true, false);
        }
        
        sound.playSound("G5");
        ui.showToast('Imagem gerada!', 'success', 3000);

    } catch (error) {
        if ((error as Error).name === 'AbortError') {
            console.log('Generation cancelled by user.');
            ui.showToast('Geração cancelada.', 'success', 3000);
        } else {
            ui.showToast((error as Error).message, 'error', 5000);
        }
        placeholderFn();
    } finally {
        ui.hideToast(toastId);
        ui.setGenerationState(false);
        state.generationController = null;
    }
}

async function handleInspireClick() {
    const theme = dom.inspirationTheme.value;
    const characterType = (document.querySelector('input[name="concept-character-type"]:checked') as HTMLInputElement)?.value || 'mulher';
    if ((!theme.trim() && !state.inspirationImage) || state.isGenerating) return;
    switchToAdvancedMode();
    await sound.startAudioContext();
    ui.setGenerationState(true);
    const toastId = ui.showToast('A gerar ideias...', 'loading');
    ui.hideError();

    try {
        const concept = await gemini.callGenerateConceptAPI(theme, state.inspirationImage, characterType);
        Object.keys(concept).forEach(id => {
            if (components[id]) {
                const textarea = dom.getEl(`${id}-textarea`) as HTMLTextAreaElement;
                if (textarea) {
                    textarea.value = concept[id];
                    state[id].text = concept[id];
                    state[id].image = null;
                    const card = textarea.closest('.bg-gray-800\\/50');
                    (dom.getEl(`${id}-preview`) as HTMLImageElement).classList.add('hidden');
                    (dom.getEl(`${id}-placeholder`) as HTMLElement).classList.remove('hidden');
                }
            }
        });
        handleCharacterUpdate();
        ui.showToast('Conceito gerado com sucesso!', 'success', 3000);
    } catch (error) {
        ui.showToast((error as Error).message, 'error', 5000);
    } finally {
        ui.hideToast(toastId);
        ui.setGenerationState(false);
        ui.resetInspiration();
        ui.updateComponentLockState();
    }
}

async function handleCaptionClick() {
    const lastVersion = state.versionHistory[state.versionHistory.length - 1];
    if (!lastVersion || state.isGenerating) return;
    await sound.startAudioContext();
    ui.setGenerationState(true);
    ui.showCaptionModal(true);
    ui.hideError();

    try {
        const captions = await gemini.callGenerateCaptionAPI(lastVersion.prompt);
        ui.displayCaptions(captions);
    } catch (error) {
        ui.displayCaptionError((error as Error).message);
    } finally {
        ui.setGenerationState(false);
    }
}

async function handleQuickCaptionClick() {
    if (!state.quickCreationResult.base64 || state.isGenerating) return;
    await sound.startAudioContext();
    ui.setGenerationState(true);
    ui.showCaptionModal(true);
    ui.hideError();

    try {
        const captions = await gemini.callGenerateCaptionAPI(state.quickCreationResult.prompt);
        ui.displayCaptions(captions);
    } catch (error) {
        ui.displayCaptionError((error as Error).message);
    } finally {
        ui.setGenerationState(false);
    }
}


async function getEditSuggestions() {
    if (state.isGenerating) return;
    await sound.startAudioContext();
    dom.suggestionsList.innerHTML = 'A procurar sugestões...';
    try {
        const currentPrompt = state.versionHistory[state.versionHistory.length - 1]?.prompt || dom.promptBaseTextarea.value;
        const suggestions = await gemini.callSuggestEditsAPI(currentPrompt);
        ui.displaySuggestions(suggestions, dom.suggestionsList, (suggestion) => {
            if(state.isGenerating) return;
            dom.editPrompt.value = suggestion;
            handleImageGeneration({ editPrompt: suggestion, isVariation: true, isQuickMode: false });
        });
    } catch (error) {
        dom.suggestionsList.innerHTML = `<span class="text-red-400">${(error as Error).message}</span>`;
    }
}

async function getQuickEditSuggestions() {
    if (state.isGenerating) return;
    await sound.startAudioContext();
    dom.quickSuggestionsList.innerHTML = 'A procurar sugestões...';
    try {
        const currentPrompt = state.quickCreationResult.prompt || dom.promptBaseTextarea.value;
        const suggestions = await gemini.callSuggestEditsAPI(currentPrompt);
        ui.displaySuggestions(suggestions, dom.quickSuggestionsList, (suggestion) => {
            if(state.isGenerating) return;
            dom.quickEditPrompt.value = suggestion;
            handleImageGeneration({ editPrompt: suggestion, isVariation: true, isQuickMode: true });
        });
    } catch (error) {
        dom.quickSuggestionsList.innerHTML = `<span class="text-red-400">${(error as Error).message}</span>`;
    }
}


async function handleGenerateScriptClick() {
    if (state.isGenerating) return;
    await sound.startAudioContext();
    ui.setGenerationState(true);
    const toastId = ui.showToast('A gerar roteiro de vídeo...', 'loading');
    ui.hideError();
    ui.hideScriptResult();

    try {
        const lastVersion = state.versionHistory[state.versionHistory.length - 1];
        if (!lastVersion) throw new Error("Gere uma imagem primeiro.");

        const scriptContext = {
            basePrompt: state.basePrompt,
            char: state.char.text,
            cloth: state.cloth.text,
            bg: state.bg.text,
            acc: state.acc.text,
            intention: dom.intentionSelector.value,
            initialImageBase64: lastVersion.base64,
            duration: dom.videoDurationSelector.value,
            style: dom.videoStyleSelector.value,
        };

        const script = await gemini.callGenerateVideoScriptAPI(scriptContext);
        ui.displayScriptResult(script.portuguese_summary, script.english_script);
        sound.playSound("A4");
        ui.showToast('Roteiro gerado!', 'success', 3000);
    } catch (error) {
        ui.showToast((error as Error).message, 'error', 5000);
    } finally {
        ui.hideToast(toastId);
        ui.setGenerationState(false);
    }
}

async function handleGenerateFinalTakeClick() {
    if (state.isGenerating) return;
    await sound.startAudioContext();
    ui.setGenerationState(true);
    const toastId = ui.showToast('A gerar cena final...', 'loading');
    ui.hideError();
    
    try {
        const lastVersion = state.versionHistory[state.versionHistory.length - 1];
        if (!lastVersion) throw new Error("Gere uma imagem primeiro.");

        const generationParams = {
            style: dom.styleSelector.value,
            intention: dom.intentionSelector.value,
            framing: state.char.framing,
            negativePrompt: dom.negativePromptTextarea.value,
            pose: dom.poseSelector.value
        };

        const finalTakeBase64 = await gemini.callGenerateFinalImageAPI(dom.scriptPromptEn.value, generationParams, { isFinalTake: true, baseImageForVariation: lastVersion.base64 });
        ui.displayFinalTakeImage(`data:image/png;base64,${finalTakeBase64}`);
        sound.playSound("C6");
        ui.showToast('Cena final gerada!', 'success', 3000);
    } catch(error) {
        ui.showToast((error as Error).message, 'error', 5000);
    } finally {
        ui.hideToast(toastId);
        ui.setGenerationState(false);
    }
}

async function handleModalImageUpload(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    state.modalImageBase64 = await fileToBase64(file);
    ui.updateModalImagePreview(URL.createObjectURL(file));
}

function handleModalConfirm() {
    if (!state.modalImageBase64 && !dom.modalTextInput.value.trim()) return;
    let editDescription = '';
    const type = state.currentModalType;
    const isQuickFlow = !!state.quickCreationResult.base64;

    if (type === 'char') {
        if (!state.modalImageBase64) return;
        state.newChar.image = state.modalImageBase64;
        editDescription = 'Mantenha a pose, roupa e cenário, mas troque o rosto do personagem para o da nova imagem de referência.';
    } else if (type === 'pose') {
        if(state.modalImageBase64) {
            state.pose.image = state.modalImageBase64;
            editDescription = 'Use a pose da nova imagem de referência para o personagem.';
        } else {
            editDescription = `Mude a pose do personagem para: ${dom.modalTextInput.value}`;
        }
    } else {
        state[type].image = state.modalImageBase64;
        state[type].text = dom.modalTextInput.value;
        editDescription = `Troque ${type === 'bg' ? 'o cenário' : 'a roupa'} para o que foi descrito ou mostrado na nova imagem.`;
    }
    ui.closeModal();
    handleImageGeneration({ editPrompt: editDescription, isVariation: true, isQuickMode: isQuickFlow });
}

function handleFixCharacterClick() {
    const isQuickFlow = !!state.quickCreationResult.base64;
    const imageSource = isQuickFlow ? state.quickCreationResult : state.versionHistory[state.versionHistory.length - 1];

    if (state.lockedCharacterImage) {
        state.lockedCharacterImage = null;
    } else {
        if (imageSource) {
            state.lockedCharacterImage = imageSource.base64;
        }
    }
    ui.updateFixCharacterButton();
}

function handleFormatChange(event: Event) {
    const target = event.target as HTMLInputElement;
    const newFormat = target.value;
    if (newFormat === state.format) return;
    
    const isQuickFlow = target.name === 'quick-format';
    
    handleImageGeneration({ newFormat, isVariation: true, isQuickMode: isQuickFlow });
}

function handleSaveProject() {
    const projectName = prompt("Digite um nome para o seu projeto:", `Projeto ${new Date().toLocaleDateString()}`);
    if (!projectName) return;

    const projectState = {
        ...state,
        sound: undefined, // Don't save sound state
        isGenerating: false,
        savedCharacters: undefined, // Don't save characters with project
        generationController: undefined, // Don't save controller
    };

    try {
        const serializedState = JSON.stringify(projectState);
        const stateSize = new Blob([serializedState]).size;
        
        if (stateSize > 4.5 * 1024 * 1024) { // ~4.5MB
            alert("Atenção: O seu projeto é muito grande e pode não ser salvo corretamente. Tente remover algumas versões do histórico.");
        }

        localStorage.setItem(`fashion_project_${Date.now()}`, JSON.stringify({ name: projectName, data: serializedState }));
        alert(`Projeto "${projectName}" salvo com sucesso!`);
    } catch (e) {
        console.error("Erro ao salvar projeto:", e);
        alert("Erro ao salvar o projeto. O armazenamento local pode estar cheio.");
    }
}

function handleLoadProject(projectKey: string) {
    const project = JSON.parse(localStorage.getItem(projectKey));
    if (project && project.data) {
        const loadedState = JSON.parse(project.data);
        const currentSavedCharacters = state.savedCharacters; // Preserve global characters
        Object.assign(state, loadedState);
        state.savedCharacters = currentSavedCharacters; // Restore global characters after loading
        ui.syncUIFromState();
        alert(`Projeto "${project.name}" carregado.`);
    }
}

async function handleConfirmMagicEdit() {
    const prompt = dom.magicEditPrompt.value.trim();
    if (!prompt) {
        alert("Por favor, descreva a alteração que deseja fazer.");
        return;
    }

    const mask = ui.getMagicEditMask();
    if (!mask) return;

    const isQuickFlow = !!state.quickCreationResult.base64;

    ui.closeMagicEditModal();
    await handleImageGeneration({
        isVariation: true,
        editPrompt: prompt,
        inpaintingMask: mask,
        isQuickMode: isQuickFlow
    });
}

// --- Quick Creation Handlers ---
function handleSimplePromptInput(event: Event) {
    switchToSimpleMode();
    const textarea = event.target as HTMLTextAreaElement;
    dom.promptBaseTextarea.value = textarea.value;
    state.basePrompt = textarea.value; // Also update state
    ui.checkPrompt(); // This enables/disables the main generate button
}

async function handleSimpleImageUpload(event: Event) {
    switchToSimpleMode();
    const input = event.target as HTMLInputElement;
    const index = parseInt(input.dataset.index, 10);
    const file = input.files?.[0];
    if (!file) return;

    const base64 = await fileToBase64(file);
    state.simpleImages[index] = base64;
    ui.updateSimpleImagePreview(index, URL.createObjectURL(file));
}

function handleRemoveSimpleImage(index: number) {
    state.simpleImages[index] = null;
    ui.clearSimpleImagePreview(index);
}

async function handleQuickEditImageUpload(event: Event) {
    const input = event.target as HTMLInputElement;
    const index = parseInt(input.dataset.index, 10);
    const file = input.files?.[0];
    if (!file) return;

    const base64 = await fileToBase64(file);
    state.quickEditImages[index] = base64;
    ui.updateQuickEditImagePreview(index, URL.createObjectURL(file));
}

function handleRemoveQuickEditImage(index: number) {
    state.quickEditImages[index] = null;
    ui.clearQuickEditImagePreview(index);
}


async function handleImprovePrompt() {
    const currentPrompt = dom.simplePromptTextarea.value;
    if (state.isGenerating || !currentPrompt.trim()) return;

    ui.setGenerationState(true);
    const toastId = ui.showToast('A melhorar o prompt...', 'loading');

    try {
        const improvedPrompt = await gemini.callImprovePromptAPI(currentPrompt);
        dom.simplePromptTextarea.value = improvedPrompt;
        // Also update the main prompt textarea
        dom.promptBaseTextarea.value = improvedPrompt;
        state.basePrompt = improvedPrompt;
        ui.showToast('Prompt melhorado!', 'success', 3000);
    } catch (error) {
        ui.showToast((error as Error).message || "Falha ao melhorar o prompt.", 'error', 5000);
    } finally {
        ui.hideToast(toastId);
        ui.setGenerationState(false);
    }
}

async function handleImproveText(isQuickMode: boolean) {
    const inputEl = isQuickMode ? dom.quickAddTextInput : dom.addTextInput;
    const currentText = inputEl.value;
    const sceneDescription = dom.promptBaseTextarea.value;

    if (state.isGenerating || !currentText.trim() || !sceneDescription.trim()) {
        if (!sceneDescription.trim()) {
            ui.showToast("Por favor, gere uma descrição da cena primeiro.", 'error', 4000);
        }
        return;
    }

    ui.setGenerationState(true);
    const toastId = ui.showToast('A melhorar o texto...', 'loading');

    try {
        const improvedText = await gemini.callImproveTextForImageAPI(currentText, sceneDescription);
        inputEl.value = improvedText;
        ui.showToast('Texto melhorado pela IA!', 'success', 3000);
    } catch (error) {
        ui.showToast((error as Error).message || "Falha ao melhorar o texto.", 'error', 5000);
    } finally {
        ui.hideToast(toastId);
        ui.setGenerationState(false);
    }
}


async function handleStructurePrompt() {
    const currentPrompt = dom.simplePromptTextarea.value;
    if (state.isGenerating || !currentPrompt.trim()) return;
    
    ui.openStructuredPromptModal();

    try {
        const structuredData = await gemini.callStructurePromptAPI(currentPrompt);
        ui.displayStructuredPromptForm(structuredData);
    } catch (error) {
        ui.showToast((error as Error).message || "Falha ao estruturar o prompt.", 'error', 5000);
        ui.closeStructuredPromptModal();
    }
}

function handleConfirmStructuredPrompt() {
    const inputs = dom.structuredPromptForm.querySelectorAll('input');
    const parts: string[] = [];
    inputs.forEach(input => {
        if (input.value.trim()) {
            parts.push(input.value.trim());
        }
    });
    const newPrompt = parts.join(', ');
    dom.simplePromptTextarea.value = newPrompt;
    dom.promptBaseTextarea.value = newPrompt;
    state.basePrompt = newPrompt;
    ui.closeStructuredPromptModal();
}

async function onGenerateOrCancel(optionsCallback: () => any) {
    if (state.isGenerating) {
        state.generationController?.abort();
    } else {
        await handleImageGeneration(optionsCallback());
    }
}


function addEventListeners() {
    dom.componentGrid.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;
        const button = target.closest('button');

        if (!button) {
            return;
        }

        // Handle remove buttons
        if (button.id.endsWith('-remove-btn')) {
            e.preventDefault();
            e.stopPropagation();
            const id = button.id.replace('-remove-btn', '');
            handleRemoveImage(id);
        }
    });

    dom.componentGrid.addEventListener('change', (e) => {
        const target = e.target as HTMLInputElement;
        if (target.name === 'char-framing') {
            state.char.framing = target.value;
            ui.updateLivePromptPreview();
        }
    });

    Object.keys(components).forEach(id => {
        dom.getEl(`${id}-upload`).addEventListener('change', (e) => handleImageUpload(e, id));
        const textarea = dom.getEl(`${id}-textarea`); // Can be null for 'ref'
        if (textarea) {
            textarea.addEventListener('input', (e) => handleTextInput(e, id));
        }
    });
    
    ['intention-selector', 'style-selector', 'pose-selector'].forEach(id => {
        dom.getEl(id).addEventListener('change', ui.updateLivePromptPreview);
    });

    dom.formatSelector.addEventListener('change', handleFormatChange);
    
    dom.inspirationTheme.addEventListener('input', ui.checkInspirationReady);
    dom.inspirationUpload.addEventListener('change', handleInspirationImageUpload);
    dom.generateDescriptionBtn.addEventListener('click', generateAndDisplayPrompt);
    dom.promptBaseTextarea.addEventListener('input', ui.checkPrompt);
    dom.generateImageBtn.addEventListener('click', () => onGenerateOrCancel(() => ({ isQuickMode: false })));
    
    dom.regenerateBtn.addEventListener('click', () => onGenerateOrCancel(() => {
        const userPrompt = dom.editPrompt.value.trim();
        const options: any = { isVariation: true, isQuickMode: false };
        if (userPrompt) {
            options.editPrompt = userPrompt;
        }
        return options;
    }));

    dom.suggestBtn.addEventListener('click', getEditSuggestions);

    dom.variationBtn.addEventListener('click', () => {
        if (state.isGenerating) return;
        const variationPrompt = 'crie uma pequena variação criativa desta imagem, alterando um detalhe subtil.';
        handleImageGeneration({ isVariation: true, editPrompt: variationPrompt, isQuickMode: false });
    });

    dom.fixCharacterBtn.addEventListener('click', handleFixCharacterClick);
    dom.upscaleBtn.addEventListener('click', () => handleImageGeneration({ isUpscale: true, isVariation: true, isQuickMode: false }));
    dom.downloadLink.addEventListener('click', (e) => ui.handleDownload(e, dom.finalImage));
    dom.inspireBtn.addEventListener('click', handleInspireClick);
    dom.captionBtn.addEventListener('click', handleCaptionClick);
    dom.captionCloseBtn.addEventListener('click', () => ui.showCaptionModal(false));
    dom.improveTextBtn.addEventListener('click', () => handleImproveText(false));
    dom.quickImproveTextBtn.addEventListener('click', () => handleImproveText(true));
    dom.applyTextBtn.addEventListener('click', () => {
        if (state.isGenerating) return;
        const textToAdd = dom.addTextInput.value.trim();
        if (!textToAdd) {
            ui.showToast('Por favor, insira o texto que deseja adicionar.', 'error', 3000);
            return;
        }
        handleImageGeneration({ isVariation: true, isQuickMode: false });
    });
    dom.quickApplyTextBtn.addEventListener('click', () => {
        if (state.isGenerating) return;
        const textToAdd = dom.quickAddTextInput.value.trim();
        if (!textToAdd) {
            ui.showToast('Por favor, insira o texto que deseja adicionar.', 'error', 3000);
            return;
        }
        handleImageGeneration({ isVariation: true, isQuickMode: true });
    });


    dom.getAll('.modal-trigger').forEach(btn => {
        btn.addEventListener('click', () => ui.openModal((btn as HTMLElement).dataset.modalType));
    });
    dom.modalCancelBtn.addEventListener('click', ui.closeModal);
    dom.modalConfirmBtn.addEventListener('click', handleModalConfirm);
    dom.modalImageUpload.addEventListener('change', handleModalImageUpload);

    dom.copyScriptBtn.addEventListener('click', ui.handleCopyScript);
    dom.generateScriptBtn.addEventListener('click', handleGenerateScriptClick);
    dom.generateFinalTakeBtn.addEventListener('click', handleGenerateFinalTakeClick);
    dom.downloadFinalTakeLink.addEventListener('click', ui.handleFinalTakeDownload);

    // Sound
    dom.muteBtn.addEventListener('click', sound.toggleMute);
    dom.volumeSlider.addEventListener('input', sound.changeVolume);

    // Save/Load Project
    dom.saveProjectBtn.addEventListener('click', handleSaveProject);
    dom.loadProjectsBtn.addEventListener('click', () => ui.openLoadProjectModal(handleLoadProject));
    dom.loadProjectCloseBtn.addEventListener('click', ui.closeLoadProjectModal);

    // Magic Edit
    dom.magicEditBtn.addEventListener('click', ui.openMagicEditModal);
    dom.magicEditCancelBtn.addEventListener('click', ui.closeMagicEditModal);
    dom.magicEditConfirmBtn.addEventListener('click', handleConfirmMagicEdit);

    // Character Library
    dom.characterLibraryBtn.addEventListener('click', rerenderCharacterLibrary);
    dom.characterLibraryCloseBtn.addEventListener('click', ui.closeCharacterLibraryModal);
    dom.newSaveCharacterBtn.addEventListener('click', handleSaveCharacter);
    dom.characterFilterPinned.addEventListener('change', rerenderCharacterLibrary);
    dom.characterFilterFavorites.addEventListener('change', rerenderCharacterLibrary);

    // Save Character Modal
    dom.saveCharacterConfirmBtn.addEventListener('click', confirmSaveCharacter);
    dom.saveCharacterCancelBtn.addEventListener('click', ui.closeSaveCharacterModal);

    // --- Quick Creation Mode ---
    dom.simplePromptTextarea.addEventListener('input', handleSimplePromptInput);
    dom.quickGenerateImageBtn.addEventListener('click', () => onGenerateOrCancel(() => ({ isQuickMode: true })));
    dom.simpleImageUploadsContainer.addEventListener('change', (e) => {
        const target = e.target as HTMLInputElement;
        if (target.type === 'file' && target.id.startsWith('simple-upload-')) {
            handleSimpleImageUpload(e);
        }
    });
    dom.simpleImageUploadsContainer.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;
        const button = target.closest('button');
        if (button && button.id.startsWith('simple-remove-btn-')) {
            const index = parseInt(button.id.split('-').pop()!, 10);
            handleRemoveSimpleImage(index);
        }
    });
    dom.improvePromptBtn.addEventListener('click', handleImprovePrompt);
    dom.structurePromptBtn.addEventListener('click', handleStructurePrompt);
    dom.quickCreationHeader.addEventListener('click', ui.toggleQuickCreationPanel);
    dom.toggleQuickEditionsBtn.addEventListener('click', ui.toggleQuickEditionsPanel);
    dom.quickCreationResultHeader.addEventListener('click', ui.toggleQuickCreationResultPanel);


    // Quick Creation Edit Panel Listeners
    dom.quickFormatSelector.addEventListener('change', handleFormatChange);
    dom.quickRegenerateBtn.addEventListener('click', () => onGenerateOrCancel(() => {
        const userPrompt = dom.quickEditPrompt.value.trim();
        const options: any = { isVariation: true, isQuickMode: true };
        if (userPrompt || state.quickEditImages.some(img => img !== null)) {
            options.editPrompt = userPrompt;
        }
        return options;
    }));
    dom.quickSuggestBtn.addEventListener('click', getQuickEditSuggestions);
    dom.quickVariationBtn.addEventListener('click', () => {
        if (state.isGenerating) return;
        const variationPrompt = 'crie uma pequena variação criativa desta imagem, alterando um detalhe subtil.';
        handleImageGeneration({ isVariation: true, editPrompt: variationPrompt, isQuickMode: true });
    });
    dom.quickFixCharacterBtn.addEventListener('click', handleFixCharacterClick);
    dom.quickUpscaleBtn.addEventListener('click', () => handleImageGeneration({ isUpscale: true, isVariation: true, isQuickMode: true }));
    dom.quickMagicEditBtn.addEventListener('click', ui.openMagicEditModal);
    dom.quickCaptionBtn.addEventListener('click', handleQuickCaptionClick);
    dom.quickDownloadLink.addEventListener('click', (e) => ui.handleDownload(e, dom.quickFinalImage));
    dom.quickEditImageUploadsContainer.addEventListener('change', (e) => {
        const target = e.target as HTMLInputElement;
        if (target.type === 'file' && target.id.startsWith('quick-edit-upload-')) {
            handleQuickEditImageUpload(e);
        }
    });
    dom.quickEditImageUploadsContainer.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;
        const button = target.closest('button');
        if (button && button.id.startsWith('quick-edit-remove-btn-')) {
            const index = parseInt(button.id.split('-').pop()!, 10);
            handleRemoveQuickEditImage(index);
        }
    });


    // Structured Prompt Modal
    dom.structuredPromptCancelBtn.addEventListener('click', ui.closeStructuredPromptModal);
    dom.structuredPromptConfirmBtn.addEventListener('click', handleConfirmStructuredPrompt);
}

function initializeApp() {
    ui.initializeUI();
    addEventListeners();
    loadSavedCharacters();
    ui.updateArtDirectionAccess();
    ui.updatePostGenerationButtons(false, false);
    (dom.getEl('framing-full') as HTMLInputElement).checked = true;
}

initializeApp();