import { state, components } from './state';
import * as dom from './dom';
import * as ui from './ui';
import * as sound from './sound';
import * as gemini from './services/geminiService';
import { fileToBase64 } from './utils';

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

    // Clear UI
    dom.promptBaseTextarea.value = '';
    dom.negativePromptTextarea.value = 'rosto deformado, mãos deformadas, múltiplos dedos, má qualidade, baixa resolução, arte de IA, gerado por computador, irreal, pouco nítido, desfocado, cartoon, pintura, feio, duplicado, moldura, bordas pretas, barras pretas';
    dom.editPrompt.value = '';
    dom.suggestionsList.innerHTML = '';
    
    ui.hideFinalImage();
    ui.showImagePlaceholder();
    dom.finalImageDisplay.style.aspectRatio = '1';
    ui.renderHistory();
    ui.updatePostGenerationButtons(false);
    ui.updateFixCharacterButton();
    
    // Reset selectors
    dom.styleSelector.selectedIndex = 0;
    dom.intentionSelector.selectedIndex = 0;
    dom.poseSelector.selectedIndex = 0;
    (dom.getEl('format-square') as HTMLInputElement).checked = true;

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
    state[id].image = null;
    ui.clearComponentPreview(id);

    // Automatically switch to text tab for better UX
    const card = dom.getEl(`${id}-preview`).closest('.bg-gray-800\\/50');
    if (card) {
        const textTabButton = card.querySelector(`button[data-type="text"]`) as HTMLButtonElement;
        if (textTabButton && !textTabButton.classList.contains('active')) {
            textTabButton.click();
        }
    }


    if (id === 'char') {
        // When removing character image, we should be in a clean state.
        // Don't keep old text.
        state.char.text = ''; 
        const charTextarea = dom.getEl('char-textarea') as HTMLTextAreaElement;
        if(charTextarea) charTextarea.value = '';
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
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    // The limit check is now handled by disabling the input via updateComponentLockState
    // No need for an alert here.

    const base64 = await fileToBase64(file);
    state[id].image = base64;
    state[id].text = '';
    ui.updateComponentPreview(id, URL.createObjectURL(file));
    
    if (id === 'char') {
        handleCharacterUpdate();
    } else {
        ui.updateArtDirectionAccess();
        ui.updateComponentLockState(); // Update lock state for non-char components
    }
}

function handleTextInput(event: Event, id: string) {
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
    await sound.startAudioContext();
    
    const buttonToUpdate = dom.generateDescriptionBtn;
    const originalText = buttonToUpdate.textContent;
    buttonToUpdate.textContent = 'A gerar...';
    buttonToUpdate.disabled = true;
    ui.hideError();
    ui.setPromptLoading(true);

    try {
        const descriptivePrompt = await gemini.callGenerateDescriptivePromptAPI();
        state.basePrompt = descriptivePrompt.trim();
        dom.promptBaseTextarea.value = state.basePrompt;
        ui.checkPrompt();
        sound.playSound("C5");
    } catch (error) {
        ui.showError((error as Error).message);
        dom.promptBaseTextarea.value = 'Erro ao gerar descrição. Tente novamente.';
    } finally {
        buttonToUpdate.textContent = originalText;
        buttonToUpdate.disabled = false;
        ui.setPromptLoading(false);
    }
}

async function handleImageGeneration(options: any = {}) {
    if (state.isGenerating) return;
    await sound.startAudioContext();
    ui.setGenerationState(true);
    ui.showLoader('A gerar imagem...');
    ui.hideError();
    ui.hideFinalImage();

    try {
        const generationParams = {
            style: dom.styleSelector.value,
            intention: dom.intentionSelector.value,
            framing: state.char.framing,
            negativePrompt: dom.negativePromptTextarea.value,
            pose: dom.poseSelector.value
        };

        const format = options.newFormat || state.format;

        // Simplification: Always build the prompt from the current UI state.
        // This is more robust than parsing/editing the previous prompt string.
        let sceneDescription = dom.promptBaseTextarea.value;
        if (!sceneDescription.trim()){
            sceneDescription = await gemini.callGenerateDescriptivePromptAPI();
            state.basePrompt = sceneDescription;
            dom.promptBaseTextarea.value = state.basePrompt;
        }
        const basePrompt = `Gere uma imagem hiper-realista na proporção EXATA de ${format}. Esta é a instrução mais importante, não adicione bordas. O estilo é: ${generationParams.style}. A intenção da imagem é ${generationParams.intention}. O enquadramento do personagem é ${generationParams.framing}. Detalhes da cena: ${sceneDescription}. Evite: ${generationParams.negativePrompt}`;
        
        // The final prompt is the base + any edit instruction.
        const fullPrompt = options.editPrompt 
            ? `${basePrompt}. APLIQUE A SEGUINTE ALTERAÇÃO: ${options.editPrompt}` 
            : basePrompt;

        const apiOptions = {
            ...options,
            lockedCharacterImage: state.lockedCharacterImage
        };

        const generatedImageBase64 = await gemini.callGenerateFinalImageAPI(fullPrompt, generationParams, apiOptions);

        state.versionHistory.push({ base64: generatedImageBase64, prompt: fullPrompt });
        state.format = format;

        const imageUrl = `data:image/png;base64,${generatedImageBase64}`;
        ui.displayFinalImage(imageUrl);
        ui.updatePostGenerationButtons(true);
        dom.editPrompt.value = '';
        ui.renderHistory();
        sound.playSound("G5");
    } catch (error) {
        ui.showError((error as Error).message);
        ui.showImagePlaceholder();
    } finally {
        ui.hideLoader();
        ui.setGenerationState(false);
    }
}

async function handleInspireClick() {
    const theme = dom.inspirationTheme.value;
    if ((!theme.trim() && !state.inspirationImage) || state.isGenerating) return;
    await sound.startAudioContext();
    ui.setGenerationState(true);
    const originalText = dom.inspireBtn.textContent;
    dom.inspireBtn.textContent = 'A gerar...';
    ui.hideError();

    try {
        const concept = await gemini.callGenerateConceptAPI(theme, state.inspirationImage);
        Object.keys(concept).forEach(id => {
            if (components[id]) {
                const textarea = dom.getEl(`${id}-textarea`) as HTMLTextAreaElement;
                if (textarea) {
                    textarea.value = concept[id];
                    state[id].text = concept[id];
                    state[id].image = null;
                    const card = textarea.closest('.bg-gray-800\\/50');
                    (card.querySelector(`button[data-type="text"]`) as HTMLElement).click();
                    (dom.getEl(`${id}-preview`) as HTMLImageElement).classList.add('hidden');
                    (dom.getEl(`${id}-placeholder`) as HTMLElement).classList.remove('hidden');
                }
            }
        });
        handleCharacterUpdate();
    } catch (error) {
        ui.showError((error as Error).message);
    } finally {
        ui.setGenerationState(false);
        dom.inspireBtn.textContent = originalText;
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

async function getEditSuggestions() {
    if (state.isGenerating) return;
    await sound.startAudioContext();
    dom.suggestionsList.innerHTML = 'A procurar sugestões...';
    try {
        const currentPrompt = state.versionHistory[state.versionHistory.length - 1]?.prompt || dom.promptBaseTextarea.value;
        const suggestions = await gemini.callSuggestEditsAPI(currentPrompt);
        ui.displaySuggestions(suggestions, (suggestion) => {
            if(state.isGenerating) return;
            dom.editPrompt.value = suggestion;
            handleImageGeneration({ editPrompt: suggestion, isVariation: true });
        });
    } catch (error) {
        dom.suggestionsList.innerHTML = `<span class="text-red-400">${(error as Error).message}</span>`;
    }
}

async function handleGenerateScriptClick() {
    if (state.isGenerating) return;
    await sound.startAudioContext();
    ui.setGenerationState(true);
    const originalText = dom.generateScriptBtn.textContent;
    dom.generateScriptBtn.textContent = "A gerar roteiro...";
    ui.hideError();
    ui.hideScriptResult();

    try {
        const lastVersion = state.versionHistory[state.versionHistory.length - 1];
        if (!lastVersion) throw new Error("Gere uma imagem primeiro.");
        const videoDuration = dom.videoDurationSelector.value;
        const videoStyle = dom.videoStyleSelector.value;

        const script = await gemini.callGenerateVideoScriptAPI(lastVersion.prompt, videoDuration, videoStyle);
        ui.displayScriptResult(script.portuguese_summary, script.english_script);
        sound.playSound("A4");
    } catch (error) {
        ui.showError((error as Error).message);
    } finally {
        ui.setGenerationState(false);
        dom.generateScriptBtn.textContent = originalText;
    }
}

async function handleGenerateFinalTakeClick() {
    if (state.isGenerating) return;
    await sound.startAudioContext();
    ui.setGenerationState(true);
    ui.showFinalTakeLoader(true);
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

        const finalTakeBase64 = await gemini.callGenerateFinalImageAPI(dom.scriptPromptEn.value, generationParams, { isFinalTake: true });
        ui.displayFinalTakeImage(`data:image/png;base64,${finalTakeBase64}`);
        sound.playSound("C6");
    } catch(error) {
        ui.showError((error as Error).message);
    } finally {
        ui.showFinalTakeLoader(false);
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
    handleImageGeneration({ editPrompt: editDescription, isVariation: true });
}

function handleFixCharacterClick() {
    if (state.lockedCharacterImage) {
        state.lockedCharacterImage = null;
    } else {
        const lastVersion = state.versionHistory[state.versionHistory.length - 1];
        if (lastVersion) {
            state.lockedCharacterImage = lastVersion.base64;
        }
    }
    ui.updateFixCharacterButton();
}

function handleFormatChange(event: Event) {
    const target = event.target as HTMLInputElement;
    const newFormat = target.value;
    if (newFormat === state.format) return;
    
    // For outpainting, we need the new format to build the prompt correctly,
    // and isVariation: true to pass the previous image as a base.
    handleImageGeneration({ newFormat, isVariation: true });
}

function handleSaveProject() {
    const projectName = prompt("Digite um nome para o seu projeto:", `Projeto ${new Date().toLocaleDateString()}`);
    if (!projectName) return;

    const projectState = {
        ...state,
        sound: undefined, // Don't save sound state
        isGenerating: false,
        savedCharacters: undefined, // Don't save characters with project
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

    ui.closeMagicEditModal();
    await handleImageGeneration({
        isVariation: true,
        editPrompt: prompt,
        inpaintingMask: mask,
    });
}


function addEventListeners() {
    dom.componentGrid.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;
        const button = target.closest('button');

        if (!button) {
            return;
        }

        // Handle tab buttons
        if (button.matches('.tab-btn')) {
            ui.switchInputType(button.dataset.id, button.dataset.type, button);
        }
        // Handle remove buttons
        else if (button.id.endsWith('-remove-btn')) {
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
    dom.generateImageBtn.addEventListener('click', () => handleImageGeneration());
    dom.regenerateBtn.addEventListener('click', () => handleImageGeneration({ editPrompt: dom.editPrompt.value, isVariation: true }));
    dom.suggestBtn.addEventListener('click', getEditSuggestions);
    dom.variationBtn.addEventListener('click', () => handleImageGeneration({ isVariation: true }));
    dom.fixCharacterBtn.addEventListener('click', handleFixCharacterClick);
    dom.upscaleBtn.addEventListener('click', () => handleImageGeneration({ isUpscale: true, isVariation: true }));
    dom.downloadLink.addEventListener('click', ui.handleDownload);
    dom.inspireBtn.addEventListener('click', handleInspireClick);
    dom.captionBtn.addEventListener('click', handleCaptionClick);
    dom.captionCloseBtn.addEventListener('click', () => ui.showCaptionModal(false));

    dom.getAll('.modal-trigger').forEach(btn => {
        btn.addEventListener('click', () => ui.openModal((btn as HTMLElement).dataset.modalType));
    });
    dom.modalCancelBtn.addEventListener('click', ui.closeModal);
    dom.modalConfirmBtn.addEventListener('click', handleModalConfirm);
    dom.modalImageUpload.addEventListener('change', handleModalImageUpload);

    dom.copyScriptBtn.addEventListener('click', ui.handleCopyScript);
    dom.generateScriptBtn.addEventListener('click', handleGenerateScriptClick);
    dom.generateFinalTakeBtn.addEventListener('click', handleGenerateFinalTakeClick);

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
}

function initializeApp() {
    ui.initializeUI();
    addEventListeners();
    loadSavedCharacters();
    ui.updateArtDirectionAccess();
    // FIX: `updatePostGenerationButtons` is a member of the `ui` module.
    ui.updatePostGenerationButtons(false);
    (dom.getEl('framing-full') as HTMLInputElement).checked = true;
}

initializeApp();