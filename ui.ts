import { state, components } from './state';
import * as dom from './dom';

let magicEditContext: CanvasRenderingContext2D;
let isDrawing = false;
let brushSize = 40;

// --- UI Logic ---

export function initializeUI() {
    Object.keys(components).filter(id => id !== 'char').forEach(id => {
        const componentData = components[id];
        const element = document.createElement('div');
        element.className = 'bg-gray-800/50 p-4 rounded-lg';
        
        if (id === 'ref') {
            element.innerHTML = `
                <h3 class="text-lg font-semibold mb-3 text-center text-gray-300">${componentData.title}</h3>
                <div class="input-container h-48">
                    <label for="ref-upload" class="upload-box w-full h-full rounded-lg flex items-center justify-center cursor-pointer p-2 relative group">
                        <div class="text-center text-gray-500 w-full h-full">
                            <img id="ref-preview" class="hidden w-full h-full rounded-md" />
                            <span id="ref-placeholder" class="flex items-center justify-center h-full">Clique para carregar</span>
                        </div>
                        <button id="ref-remove-btn" class="absolute top-2 right-2 bg-red-600 text-white rounded-full w-6 h-6 flex items-center justify-center hidden opacity-0 group-hover:opacity-100 transition-opacity z-10 text-xl font-bold leading-none" title="Remover Imagem">&times;</button>
                    </label>
                    <input type="file" id="ref-upload" class="hidden" accept="image/*">
                </div>`;
        } else {
            element.innerHTML = `
                <h3 class="text-lg font-semibold mb-3 text-center text-gray-300">${componentData.title}</h3>
                <nav class="flex justify-center mb-3">
                    <button data-id="${id}" data-type="image" class="tab-btn active px-4 py-2 text-sm font-medium">Imagem</button>
                    <button data-id="${id}" data-type="text" class="tab-btn px-4 py-2 text-sm font-medium">Texto</button>
                </nav>
                <div class="input-container h-48">
                    <label for="${id}-upload" class="upload-box w-full h-full rounded-lg flex items-center justify-center cursor-pointer p-2 relative group">
                        <div class="text-center text-gray-500 w-full h-full">
                            <img id="${id}-preview" class="hidden w-full h-full rounded-md" />
                            <span id="${id}-placeholder" class="flex items-center justify-center h-full">Clique para carregar</span>
                        </div>
                        <button id="${id}-remove-btn" class="absolute top-2 right-2 bg-red-600 text-white rounded-full w-6 h-6 flex items-center justify-center hidden opacity-0 group-hover:opacity-100 transition-opacity z-10 text-xl font-bold leading-none" title="Remover Imagem">&times;</button>
                        <div id="${id}-locked-overlay" class="absolute inset-0 bg-gray-900/80 rounded-lg flex-col items-center justify-center text-center p-4 text-gray-400 hidden">
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mb-2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                            <p class="text-xs">Você pode carregar no máximo 3 imagens de componentes para a cena. Para adicionar uma nova, remova uma imagem existente primeiro.</p>
                        </div>
                    </label>
                    <input type="file" id="${id}-upload" class="hidden" accept="image/*">
                    <textarea id="${id}-textarea" class="hidden w-full h-full bg-gray-700 border border-gray-600 text-white text-sm rounded-lg p-2.5" placeholder="Descreva (opcional)..."></textarea>
                </div>`;
        }
        dom.componentGrid.appendChild(element);
    });
    updateLivePromptPreview();
    setupMagicEditCanvas();
}

export function switchInputType(id: string, type: string, clickedButton: HTMLElement) {
    const card = clickedButton.closest('.bg-gray-800\\/50');
    card.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    clickedButton.classList.add('active');
    const uploadBox = card.querySelector(`label[for="${id}-upload"]`);
    const textarea = card.querySelector(`#${id}-textarea`);
    uploadBox.classList.toggle('hidden', type !== 'image');
    textarea.classList.toggle('hidden', type === 'image');
}

export function clearComponentPreview(id: string) {
    const preview = dom.getEl(`${id}-preview`) as HTMLImageElement;
    const placeholder = dom.getEl(`${id}-placeholder`);
    const removeBtn = dom.getEl(`${id}-remove-btn`);
    const uploadInput = dom.getEl(`${id}-upload`) as HTMLInputElement;

    preview.src = '';
    preview.classList.add('hidden');
    placeholder.classList.remove('hidden');
    if (removeBtn) {
        removeBtn.classList.add('hidden');
    }
    if (uploadInput) {
        uploadInput.value = '';
    }
}

export function updateComponentPreview(id: string, src: string) {
    const preview = dom.getEl(`${id}-preview`) as HTMLImageElement;
    const placeholder = dom.getEl(`${id}-placeholder`);
    const removeBtn = dom.getEl(`${id}-remove-btn`);
    preview.src = src;
    preview.classList.remove('hidden');
    placeholder.classList.add('hidden');
    if (removeBtn) {
        removeBtn.classList.remove('hidden');
    }
}

export function updateComponentLockState() {
    const limitedComponentIds = ['bg', 'cloth', 'acc', 'prod'];
    const imageCount = limitedComponentIds.filter(id => state[id].image).length;
    const isLocked = imageCount >= 3;

    limitedComponentIds.forEach(id => {
        const uploadBox = dom.getEl(`${id}-upload`).parentElement as HTMLLabelElement;
        const lockOverlay = dom.getEl(`${id}-locked-overlay`);
        const uploadInput = dom.getEl(`${id}-upload`) as HTMLInputElement;
        
        if (isLocked && !state[id].image) {
            lockOverlay.classList.remove('hidden');
            lockOverlay.classList.add('flex');
            uploadInput.disabled = true;
            uploadBox.classList.add('cursor-not-allowed', 'opacity-60');
        } else {
            lockOverlay.classList.add('hidden');
            lockOverlay.classList.remove('flex');
            uploadInput.disabled = false;
            uploadBox.classList.remove('cursor-not-allowed', 'opacity-60');
        }
    });
}

export function updateInspirationPreview(src: string) {
    dom.inspirationPreview.src = src;
    dom.inspirationPreview.classList.remove('hidden');
    dom.inspirationPlaceholder.classList.add('hidden');
}

export function checkPrompt() {
    const hasPrompt = dom.promptBaseTextarea.value.trim() !== '';
    dom.generateImageBtn.disabled = !hasPrompt;
}

export function updateArtDirectionAccess() {
    const charProvided = state.char.image || state.char.text.trim();
    dom.artDirectionContent.classList.toggle('content-disabled', !charProvided);
    dom.artDirectionPlaceholder.classList.toggle('hidden', charProvided);
    
    const saveBtn = dom.newSaveCharacterBtn;
    const savePlaceholder = dom.saveCharacterPlaceholder;

    if (saveBtn && savePlaceholder) {
        saveBtn.classList.toggle('hidden', !charProvided);
        savePlaceholder.classList.toggle('hidden', charProvided);
    }

    if (!charProvided) {
       dom.generateImageBtn.disabled = true;
    } else {
       checkPrompt();
    }
}


export function checkInspirationReady(){
    const theme = dom.inspirationTheme.value.trim();
    dom.inspireBtn.disabled = !theme && !state.inspirationImage;
}

export function setGenerationState(isGenerating: boolean) {
    state.isGenerating = isGenerating;
    const buttons = [dom.generateDescriptionBtn, dom.generateImageBtn, dom.regenerateBtn, dom.variationBtn, dom.fixCharacterBtn, dom.upscaleBtn, dom.suggestBtn, dom.inspireBtn, dom.captionBtn, dom.generateScriptBtn, dom.generateFinalTakeBtn, dom.magicEditBtn, ...dom.getAll('.modal-trigger')];
    buttons.forEach(btn => {
        if(btn) {
            (btn as HTMLButtonElement).disabled = isGenerating;
            btn.classList.toggle('btn-disabled', isGenerating);
        }
    });
     if(!isGenerating) {
        updateArtDirectionAccess();
        checkInspirationReady();
        updatePostGenerationButtons(state.versionHistory.length > 0);
    }
}

export function updatePostGenerationButtons(isEnabled: boolean) {
    const sectionsToToggle = [
        dom.postGenerationActions,
        dom.getEl('refinement-content'),
        dom.getEl('edit-buttons-container'),
        dom.videoPanel,
    ];
    sectionsToToggle.forEach(section => section?.classList.toggle('content-disabled', !isEnabled));
    
    const buttons = [dom.captionBtn, dom.downloadLink, dom.regenerateBtn, dom.suggestBtn, dom.variationBtn, dom.fixCharacterBtn, dom.upscaleBtn, dom.generateScriptBtn, dom.generateFinalTakeBtn, dom.magicEditBtn, ...dom.getAll('.modal-trigger')];
    buttons.forEach(btn => {
        if(btn) {
            if(btn.tagName === 'A') {
                 btn.classList.toggle('pointer-events-none', !isEnabled);
                 btn.classList.toggle('opacity-50', !isEnabled);
            } else {
                (btn as HTMLButtonElement).disabled = !isEnabled;
                btn.classList.toggle('btn-disabled', !isEnabled);
            }
        }
    });

    dom.getAll('#format-selector input').forEach(input => {
        (input as HTMLInputElement).disabled = !isEnabled;
    });

    updateFixCharacterButton();
}

export function showLoader(text = "A processar...", element = dom.imageLoader) {
    const loaderTextEl = element.querySelector('span');
    if(loaderTextEl) loaderTextEl.textContent = text;
    element.classList.remove('hidden');
    element.classList.add('flex');
}

export function hideLoader(element = dom.imageLoader) {
    element.classList.add('hidden');
    element.classList.remove('flex');
}

export function hideError() {
    dom.errorMessage.classList.add('hidden');
}

export function showError(message: string) {
    dom.errorMessage.textContent = message;
    dom.errorMessage.classList.remove('hidden');
}

export function handleDownload(e: MouseEvent) {
     e.preventDefault();
     if(dom.finalImage.src && dom.finalImage.src.startsWith('data:image')) {
        const link = document.createElement('a');
        link.href = dom.finalImage.src;
        link.download = `lookbook-ia-${Date.now()}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
     }
}

export function renderHistory() {
    dom.versionHistoryContainer.innerHTML = '';
    state.versionHistory.forEach((versionData) => {
        const img = document.createElement('img');
        img.src = `data:image/png;base64,${versionData.base64}`;
        img.className = 'history-thumbnail w-20 h-20 object-cover rounded-md cursor-pointer';
        if (dom.finalImage.src === img.src) {
            img.classList.add('active');
        }
        img.onclick = () => {
            if (state.isGenerating) return;
            const currentBase64 = img.src.split(',')[1];
            displayFinalImage(img.src);

            const version = state.versionHistory.find(v => v.base64 === currentBase64);
            if(version) {
                state.basePrompt = version.prompt.split("Detalhes da cena:")[1]?.trim().split(". Evite:")[0] || state.basePrompt;
                dom.promptBaseTextarea.value = state.basePrompt;
            }
            
            updateLivePromptPreview();
            renderHistory();
        };
        dom.versionHistoryContainer.appendChild(img);
    });
    dom.historyPanel.classList.toggle('hidden', state.versionHistory.length === 0);
}

export function hideFinalImage() {
    dom.finalImage.classList.add('hidden');
    dom.imagePlaceholder.classList.add('hidden');
}

export function showImagePlaceholder() {
    dom.imagePlaceholder.classList.remove('hidden');
}

export function displayFinalImage(imageUrl: string) {
    dom.finalImage.src = imageUrl;
    dom.downloadLink.href = imageUrl;
    dom.finalImage.classList.remove('hidden');

    const setAspectRatio = () => {
        if (dom.finalImage.naturalHeight > 0 && dom.finalImage.naturalWidth > 0) {
            dom.finalImageDisplay.style.aspectRatio = (dom.finalImage.naturalWidth / dom.finalImage.naturalHeight).toString();
        } else {
            dom.finalImageDisplay.style.aspectRatio = '1';
        }
    };

    dom.finalImage.onload = setAspectRatio;
    // Handle cases where the image is already cached
    if (dom.finalImage.complete && dom.finalImage.naturalHeight > 0) {
        setAspectRatio();
    }

    const formatValue = state.format;
    const formatRadio = dom.getEl(`format-${formatValue.replace(':', '')}`) as HTMLInputElement;
     if (formatRadio) {
        formatRadio.checked = true;
    } else {
        const squareRadio = dom.getEl('format-square') as HTMLInputElement;
        if(squareRadio) squareRadio.checked = true;
    }
}

export function resetInspiration() {
    dom.inspirationTheme.value = '';
    dom.inspirationUpload.value = '';
    dom.inspirationPreview.classList.add('hidden');
    dom.inspirationPlaceholder.classList.remove('hidden');
    state.inspirationImage = null;
    checkInspirationReady();
}

export function showCaptionModal(show: boolean) {
    if (show) {
        dom.captionList.innerHTML = '<div class="flex justify-center"><div class="loader"></div></div>';
        dom.captionModal.classList.remove('opacity-0', 'pointer-events-none');
    } else {
        dom.captionModal.classList.add('opacity-0', 'pointer-events-none');
    }
}

export function displayCaptions(captions: string[]) {
    dom.captionList.innerHTML = '';
    captions.forEach(captionText => {
        const div = document.createElement('div');
        div.className = "bg-gray-700 p-3 rounded-lg flex justify-between items-start gap-2";
        const p = document.createElement('p');
        p.className = "text-sm text-gray-300";
        p.innerText = captionText;
        
        const copyBtn = document.createElement('button');
        copyBtn.className = "bg-indigo-600 text-white text-xs font-bold py-1 px-2 rounded hover:bg-indigo-700 flex-shrink-0";
        copyBtn.textContent = "Copiar";
        copyBtn.onclick = () => {
            navigator.clipboard.writeText(p.innerText).then(() => {
                copyBtn.textContent = "Copiado!";
                setTimeout(() => { copyBtn.textContent = "Copiar"; }, 2000);
            }).catch(err => {
                console.error('Falha ao copiar: ', err);
                copyBtn.textContent = "Erro!";
            });
        };
        div.appendChild(p);
        div.appendChild(copyBtn);
        dom.captionList.appendChild(div);
    });
}

export function displayCaptionError(message: string) {
    dom.captionList.innerHTML = `<p class="text-red-400">${message}</p>`;
}

export function displaySuggestions(suggestions: string[], onClick: (suggestion: string) => void) {
    dom.suggestionsList.innerHTML = '';
    suggestions.forEach(suggestion => {
        const li = document.createElement('li');
        li.textContent = `- ${suggestion}`;
        li.className = 'cursor-pointer p-1 rounded hover:bg-gray-700 suggestion-item';
        li.onclick = () => onClick(suggestion);
        dom.suggestionsList.appendChild(li);
    });
}

export function hideScriptResult() {
    dom.scriptResultContainer.classList.add('hidden');
}

export function displayScriptResult(summary: string, script: string) {
    dom.scriptSummaryPt.textContent = summary;
    dom.scriptPromptEn.value = script;
    dom.scriptResultContainer.classList.remove('hidden');
}

export function handleCopyScript() {
    navigator.clipboard.writeText(dom.scriptPromptEn.value).then(() => {
        dom.copyScriptBtn.textContent = "Copiado!";
        setTimeout(() => { dom.copyScriptBtn.textContent = "Copiar"; }, 2000);
    });
}

export function showFinalTakeLoader(show: boolean) {
    if (show) {
        showLoader("A gerar cena final...", dom.finalTakeLoader);
        dom.finalTakeImage.classList.add('hidden');
    } else {
        hideLoader(dom.finalTakeLoader);
    }
}

export function displayFinalTakeImage(src: string) {
    dom.finalTakeImage.src = src;
    dom.finalTakeImage.classList.remove('hidden');
}

export function openModal(type: string) {
    if (state.isGenerating) return;
    state.currentModalType = type;
    state.modalImageBase64 = null;
    dom.modalImagePreview.classList.add('hidden');
    dom.modalImagePlaceholder.classList.remove('hidden');
    dom.modalImageUpload.value = '';
    dom.modalTextInput.value = '';
    
    const configs = {
        char: { title: 'Trocar Rosto', instruction: 'Carregue uma imagem do novo rosto para aplicar à imagem atual.' },
        pose: { title: 'Trocar Pose', instruction: 'Carregue uma imagem de referência ou descreva a pose desejada.' },
        cloth: { title: 'Trocar Roupa', instruction: 'Carregue uma imagem da nova roupa ou descreva-a.' },
        bg: { title: 'Trocar Cenário', instruction: 'Carregue uma imagem do novo cenário ou descreva-o.' }
    };
    
    dom.modalTitle.textContent = configs[type].title;
    dom.modalInstruction.textContent = configs[type].instruction;
    const showText = type !== 'char';
    dom.modalTextInput.style.display = showText ? 'block' : 'none';
    dom.modalOrDivider.style.display = showText ? 'block' : 'none';
    dom.genericModal.classList.remove('opacity-0', 'pointer-events-none');
}

export function closeModal() {
    dom.genericModal.classList.add('opacity-0', 'pointer-events-none');
}

export function updateModalImagePreview(src: string) {
    dom.modalImagePreview.src = src;
    dom.modalImagePreview.classList.remove('hidden');
    dom.modalImagePlaceholder.classList.add('hidden');
}

export function setPromptLoading(isLoading: boolean) {
    if (isLoading) {
        dom.promptBaseTextarea.value = 'A gerar descrição com base nos componentes...';
        dom.promptBaseTextarea.disabled = true;
    } else {
        dom.promptBaseTextarea.disabled = false;
    }
}

export function updateLivePromptPreview() {
    const intention = dom.intentionSelector.options[dom.intentionSelector.selectedIndex].text;
    const style = dom.styleSelector.options[dom.styleSelector.selectedIndex].text;
    const framing = state.char.framing;
    const pose = dom.poseSelector.value ? `Pose: ${dom.poseSelector.options[dom.poseSelector.selectedIndex].text}.` : '';

    const previewHTML = `
        <span><strong>Intenção:</strong> ${intention}</span><br>
        <span><strong>Estilo:</strong> ${style}</span><br>
        <span><strong>Enquadramento:</strong> ${framing}</span>
        ${pose ? `<br><span><strong>Pose:</strong> ${dom.poseSelector.options[dom.poseSelector.selectedIndex].text}</span>` : ''}
    `;
    dom.promptPreview.innerHTML = previewHTML;
}

export function updateFixCharacterButton() {
    const isLocked = !!state.lockedCharacterImage;
    dom.fixCharacterBtn.classList.toggle('locked', isLocked);
    dom.fixCharacterBtn.textContent = isLocked ? '✨ Rosto Fixo' : '✨ Fixar Rosto';
}

export function openLoadProjectModal(loadCallback: (key: string) => void) {
    dom.projectList.innerHTML = '';
    const projects = Object.keys(localStorage)
        .filter(key => key.startsWith('fashion_project_'))
        .map(key => ({ key, ...JSON.parse(localStorage.getItem(key)) }))
        .sort((a, b) => b.key.split('_')[2] - a.key.split('_')[2]);

    if (projects.length === 0) {
        dom.projectList.innerHTML = '<p class="text-gray-400 text-center">Nenhum projeto salvo encontrado.</p>';
    } else {
        projects.forEach(project => {
            const div = document.createElement('div');
            div.className = 'flex justify-between items-center p-2 bg-gray-700 rounded-md';
            div.innerHTML = `<span>${project.name}</span>`;
            
            const loadBtn = document.createElement('button');
            loadBtn.textContent = 'Carregar';
            loadBtn.className = 'bg-indigo-600 text-white text-xs font-bold py-1 px-2 rounded hover:bg-indigo-700';
            loadBtn.onclick = () => {
                closeLoadProjectModal();
                loadCallback(project.key);
            };
            div.appendChild(loadBtn);
            dom.projectList.appendChild(div);
        });
    }

    dom.loadProjectModal.classList.remove('opacity-0', 'pointer-events-none');
}

export function closeLoadProjectModal() {
    dom.loadProjectModal.classList.add('opacity-0', 'pointer-events-none');
}

export function syncCharacterComponentFromState() {
    const compState = state.char;
    const id = 'char';
    const textarea = dom.getEl(`${id}-textarea`) as HTMLTextAreaElement;
    const card = textarea.closest('.bg-gray-800\\/50');

    textarea.value = compState.text || '';
    if (compState.image) {
        updateComponentPreview(id, `data:image/png;base64,${compState.image}`);
        (card.querySelector(`button[data-type="image"]`) as HTMLElement).click();
    } else {
        clearComponentPreview(id);
        if (compState.text) {
             (card.querySelector(`button[data-type="text"]`) as HTMLElement).click();
        } else {
             (card.querySelector(`button[data-type="image"]`) as HTMLElement).click();
        }
    }

    const framingRadios = document.querySelectorAll<HTMLInputElement>('input[name="char-framing"]');
    let framingSet = false;
    framingRadios.forEach(radio => {
        if (radio.value === compState.framing) {
            radio.checked = true;
            framingSet = true;
        } else {
            radio.checked = false;
        }
    });
    if (!framingSet) {
        (dom.getEl('framing-full') as HTMLInputElement).checked = true;
    }
}

export function syncUIFromState() {
    // Sync components
    Object.keys(components).forEach(id => {
        if (id === 'char' || id === 'ref') return;
        const compState = state[id];
        const textarea = dom.getEl(`${id}-textarea`) as HTMLTextAreaElement;
        const card = textarea.closest('.bg-gray-800\\/50');

        textarea.value = compState.text || '';
        if (compState.image) {
            updateComponentPreview(id, `data:image/png;base64,${compState.image}`);
            (card.querySelector(`button[data-type="image"]`) as HTMLElement).click();
        } else {
            clearComponentPreview(id);
            if (compState.text) {
                (card.querySelector(`button[data-type="text"]`) as HTMLElement).click();
            } else {
                (card.querySelector(`button[data-type="image"]`) as HTMLElement).click();
            }
        }
    });
    if (state.ref.image) {
        updateComponentPreview('ref', `data:image/png;base64,${state.ref.image}`);
    } else {
        clearComponentPreview('ref');
    }
    
    syncCharacterComponentFromState();

    // Sync art direction
    dom.promptBaseTextarea.value = state.basePrompt || '';

    // Sync history and final image
    if (state.versionHistory.length > 0) {
        const lastVersion = state.versionHistory[state.versionHistory.length - 1];
        displayFinalImage(`data:image/png;base64,${lastVersion.base64}`);
        renderHistory();
        updatePostGenerationButtons(true);
    } else {
        dom.finalImage.src = '';
        dom.finalImage.classList.add('hidden');
        dom.historyPanel.classList.add('hidden');
        showImagePlaceholder();
        updatePostGenerationButtons(false);
    }
     updateArtDirectionAccess();
     updateComponentLockState();
}

// --- Magic Edit Canvas ---
function setupMagicEditCanvas() {
    magicEditContext = dom.magicEditCanvas.getContext('2d');
    
    dom.brushSizeSlider.addEventListener('input', (e) => {
        brushSize = parseInt((e.target as HTMLInputElement).value, 10);
    });

    const getPos = (e: MouseEvent | TouchEvent) => {
        const rect = dom.magicEditCanvas.getBoundingClientRect();
        const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
        const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
        return {
            x: (clientX - rect.left) / rect.width * dom.magicEditCanvas.width,
            y: (clientY - rect.top) / rect.height * dom.magicEditCanvas.height,
        };
    };
    
    const startDrawing = (e: MouseEvent | TouchEvent) => {
        e.preventDefault();
        isDrawing = true;
        const { x, y } = getPos(e);
        magicEditContext.beginPath();
        magicEditContext.moveTo(x, y);
    };

    const draw = (e: MouseEvent | TouchEvent) => {
        if (!isDrawing) return;
        e.preventDefault();
        const { x, y } = getPos(e);
        magicEditContext.lineTo(x, y);
        magicEditContext.strokeStyle = 'rgba(255, 0, 255, 0.7)';
        magicEditContext.lineWidth = brushSize;
        magicEditContext.lineCap = 'round';
        magicEditContext.lineJoin = 'round';
        magicEditContext.stroke();
        magicEditContext.beginPath();
        magicEditContext.moveTo(x, y);
    };

    const stopDrawing = () => {
        isDrawing = false;
        magicEditContext.beginPath();
    };

    dom.magicEditCanvas.addEventListener('mousedown', startDrawing);
    dom.magicEditCanvas.addEventListener('mousemove', draw);
    dom.magicEditCanvas.addEventListener('mouseup', stopDrawing);
    dom.magicEditCanvas.addEventListener('mouseout', stopDrawing);
    
    dom.magicEditCanvas.addEventListener('touchstart', startDrawing);
    dom.magicEditCanvas.addEventListener('touchmove', draw);
    dom.magicEditCanvas.addEventListener('touchend', stopDrawing);
}

export function openMagicEditModal() {
    const lastVersion = state.versionHistory[state.versionHistory.length - 1];
    if (!lastVersion) return;

    const img = new Image();
    img.onload = () => {
        dom.magicEditCanvas.width = img.naturalWidth;
        dom.magicEditCanvas.height = img.naturalHeight;
        
        const backgroundCanvas = document.createElement('canvas');
        backgroundCanvas.width = img.naturalWidth;
        backgroundCanvas.height = img.naturalHeight;
        backgroundCanvas.getContext('2d').drawImage(img, 0, 0);
        dom.magicEditCanvas.style.backgroundImage = `url(${backgroundCanvas.toDataURL()})`;
        dom.magicEditCanvas.style.backgroundSize = 'contain';

        magicEditContext.clearRect(0, 0, dom.magicEditCanvas.width, dom.magicEditCanvas.height);
        dom.magicEditPrompt.value = '';
        dom.magicEditModal.classList.remove('opacity-0', 'pointer-events-none');
    };
    img.src = `data:image/png;base64,${lastVersion.base64}`;
}

export function closeMagicEditModal() {
    dom.magicEditModal.classList.add('opacity-0', 'pointer-events-none');
}

export function getMagicEditMask(): string | null {
    if (!magicEditContext) return null;

    // Create a temporary canvas to convert the colored strokes to pure white
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = dom.magicEditCanvas.width;
    tempCanvas.height = dom.magicEditCanvas.height;
    const tempCtx = tempCanvas.getContext('2d');
    
    // Draw the user's strokes (e.g., in magenta) onto the temporary canvas
    tempCtx.drawImage(dom.magicEditCanvas, 0, 0);
    // Use 'source-in' to replace the color of the strokes with white
    tempCtx.globalCompositeOperation = 'source-in';
    tempCtx.fillStyle = 'white';
    tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);

    // Create the final mask canvas
    const finalMaskCanvas = document.createElement('canvas');
    finalMaskCanvas.width = dom.magicEditCanvas.width;
    finalMaskCanvas.height = dom.magicEditCanvas.height;
    const finalCtx = finalMaskCanvas.getContext('2d');

    // Fill the final mask with black
    finalCtx.fillStyle = 'black';
    finalCtx.fillRect(0, 0, finalMaskCanvas.width, finalMaskCanvas.height);
    // Draw the white strokes on top of the black background
    finalCtx.drawImage(tempCanvas, 0, 0);

    // Return the base64 representation of the final black and white mask
    return finalMaskCanvas.toDataURL('image/png').split(',')[1];
}

// --- Character Library ---
export function closeCharacterLibraryModal() {
    dom.characterLibraryModal.classList.add('opacity-0', 'pointer-events-none');
}

export function openCharacterLibraryModal(
    characters: any[], 
    callbacks: {
        onLoad: (id: string) => void,
        onDelete: (id: string) => void,
        onToggleFavorite: (id: string) => void,
        onTogglePin: (id: string) => void,
    }
) {
    const filterPinned = dom.characterFilterPinned.checked;
    const filterFavorites = dom.characterFilterFavorites.checked;

    const sortedCharacters = [...characters].sort((a, b) => {
        if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
        if (a.isFavorite !== b.isFavorite) return a.isFavorite ? -1 : 1;
        return b.timestamp - a.timestamp;
    });
    
    const filteredCharacters = sortedCharacters.filter(char => {
        if (filterPinned && !char.isPinned) return false;
        if (filterFavorites && !char.isFavorite) return false;
        return true;
    });

    dom.characterList.innerHTML = '';
    if (filteredCharacters.length === 0) {
        dom.characterList.innerHTML = `<p class="text-gray-400 text-center col-span-full">Nenhum personagem encontrado. Salve um personagem para começar!</p>`;
    } else {
        filteredCharacters.forEach(char => {
            const charCard = document.createElement('div');
            charCard.className = 'relative group aspect-[3/4] bg-gray-900 rounded-lg overflow-hidden cursor-pointer';
            
            const imageSrc = char.char.image ? `data:image/png;base64,${char.char.image}` : 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'; // transparent pixel
            const textOverlay = char.char.image ? '' : `<div class="absolute inset-0 flex items-center justify-center p-2 text-center text-xs text-gray-400">${char.char.text || char.name}</div>`;
            const pinIcon = char.isPinned 
                ? `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M16 3a1 1 0 0 1 .117 1.993L16 5v4.764l1.894 3.787A1 1 0 0 1 17 15.236V16a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1v-.764a1 1 0 0 1 .106-1.449L9 9.764V5a1 1 0 0 1 1.993-.117L11 5v4.236l-1.894 3.787A1 1 0 0 1 9 14.473V15h6v-.527a1 1 0 0 1 .106-.449L13 10.236V5a1 1 0 0 1 1-1h2z"></path></svg>`
                : `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 3v2.586l-2.293 2.293a1 1 0 0 0-.293.707V16l-3-2-3 2V8.586a1 1 0 0 0-.293-.707L5 5.586V3h11z"></path><line x1="9" y1="1" x2="15" y2="1"></line></svg>`;
            const favIcon = char.isFavorite
                ? `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"></path></svg>`
                : `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>`;

            charCard.innerHTML = `
                <img src="${imageSrc}" class="w-full h-full object-cover transition-transform group-hover:scale-105" alt="${char.name}">
                ${textOverlay}
                <div class="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent"></div>
                <div class="absolute bottom-0 left-0 right-0 p-2 text-white">
                    <p class="font-bold text-sm truncate">${char.name}</p>
                </div>
                <div class="absolute top-1 right-1 flex flex-col gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button data-action="pin" title="Fixar" class="p-1.5 rounded-full ${char.isPinned ? 'bg-violet-500 text-white' : 'bg-black/50 hover:bg-violet-500'}">${pinIcon}</button>
                    <button data-action="favorite" title="Favoritar" class="p-1.5 rounded-full ${char.isFavorite ? 'bg-rose-500 text-white' : 'bg-black/50 hover:bg-rose-500'}">${favIcon}</button>
                    <button data-action="delete" title="Apagar" class="p-1.5 rounded-full bg-black/50 hover:bg-red-600"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg></button>
                </div>
            `;
            
            charCard.addEventListener('click', (e) => {
                const target = e.target as HTMLElement;
                const button = target.closest('button');
                if (button) {
                    e.stopPropagation(); 
                    const action = button.dataset.action;
                    if (action === 'delete') callbacks.onDelete(char.id);
                    else if (action === 'favorite') callbacks.onToggleFavorite(char.id);
                    else if (action === 'pin') callbacks.onTogglePin(char.id);
                } else {
                    callbacks.onLoad(char.id);
                }
            });

            dom.characterList.appendChild(charCard);
        });
    }

    dom.characterLibraryModal.classList.remove('opacity-0', 'pointer-events-none');
}

// --- Character Save Modal ---
export function openSaveCharacterModal(defaultName: string) {
    dom.saveCharacterNameInput.value = defaultName;
    dom.saveCharacterModal.classList.remove('opacity-0', 'pointer-events-none');
    dom.saveCharacterNameInput.focus();
    dom.saveCharacterNameInput.select();
}

export function closeSaveCharacterModal() {
    dom.saveCharacterModal.classList.add('opacity-0', 'pointer-events-none');
}