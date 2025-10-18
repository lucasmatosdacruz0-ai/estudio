export const getEl = (id: string): HTMLElement => document.getElementById(id);
export const getAll = (selector: string): NodeListOf<HTMLElement> => document.querySelectorAll(selector);

// --- Global DOM References ---
export const toastContainer = getEl('toast-container');
export const componentGrid = getEl('component-grid');
export const promptDetailsSection = getEl('prompt-details-section');
export const artDirectionContent = getEl('art-direction-content');
export const artDirectionPlaceholder = getEl('art-direction-placeholder');
export const generateDescriptionBtn = getEl('generate-scene-description-btn') as HTMLButtonElement;
export const intentionSelector = getEl('intention-selector') as HTMLSelectElement;
export const styleSelector = getEl('style-selector') as HTMLSelectElement;
export const poseSelector = getEl('pose-selector') as HTMLSelectElement;
export const promptPreview = getEl('prompt-preview');
export const promptBaseTextarea = getEl('prompt-base-textarea') as HTMLTextAreaElement;
export const negativePromptTextarea = getEl('negative-prompt-textarea') as HTMLTextAreaElement;
export const generateImageBtn = getEl('generate-image-btn') as HTMLButtonElement;
export const editPanel = getEl('edit-panel');
export const finalImageDisplay = getEl('final-image-display');
export const finalImage = getEl('final-image') as HTMLImageElement;
export const imagePlaceholder = getEl('image-placeholder');
export const downloadLink = getEl('download-link') as HTMLAnchorElement;
export const errorMessage = getEl('error-message');
export const editPrompt = getEl('edit-prompt') as HTMLInputElement;
export const regenerateBtn = getEl('regenerate-btn') as HTMLButtonElement;
export const suggestBtn = getEl('suggest-btn') as HTMLButtonElement;
export const suggestionsList = getEl('suggestions-list');
export const variationBtn = getEl('variation-btn') as HTMLButtonElement;
export const fixCharacterBtn = getEl('fix-character-btn') as HTMLButtonElement;
export const upscaleBtn = getEl('upscale-btn') as HTMLButtonElement;
export const genericModal = getEl('generic-modal');
export const formatSelector = getEl('format-selector');
export const historyPanel = getEl('history-panel');
export const versionHistoryContainer = getEl('version-history-container');
export const inspireBtn = getEl('inspire-btn') as HTMLButtonElement;
export const inspirationTheme = getEl('inspiration-theme') as HTMLInputElement;
export const inspirationUpload = getEl('inspiration-upload') as HTMLInputElement;
export const inspirationPreview = getEl('inspiration-preview') as HTMLImageElement;
export const inspirationPlaceholder = getEl('inspiration-placeholder');
export const captionBtn = getEl('caption-btn') as HTMLButtonElement;
export const captionModal = getEl('caption-modal');
export const captionList = getEl('caption-list');
export const captionCloseBtn = getEl('caption-close-btn');
export const modalTitle = getEl('modal-title');
export const modalInstruction = getEl('modal-instruction');
export const modalImageUpload = getEl('modal-image-upload') as HTMLInputElement;
export const modalImagePreview = getEl('modal-image-preview') as HTMLImageElement;
export const modalImagePlaceholder = getEl('modal-image-placeholder');
export const modalTextInput = getEl('modal-text-input') as HTMLTextAreaElement;
export const modalCancelBtn = getEl('modal-cancel-btn');
export const modalConfirmBtn = getEl('modal-confirm-btn');
export const modalOrDivider = getEl('modal-or-divider');
export const muteBtn = getEl('mute-btn');
export const volumeSlider = getEl('volume-slider') as HTMLInputElement;
export const speakerOnIcon = getEl('speaker-on-icon');
export const speakerOffIcon = getEl('speaker-off-icon');
export const videoPanel = getEl('video-panel');
export const videoDurationSelector = getEl('video-duration-selector') as HTMLSelectElement;
export const videoStyleSelector = getEl('video-style-selector') as HTMLSelectElement;
export const generateScriptBtn = getEl('generate-script-btn') as HTMLButtonElement;
export const scriptResultContainer = getEl('script-result-container');
export const scriptSummaryPt = getEl('script-summary-pt');
export const scriptPromptEn = getEl('script-prompt-en') as HTMLTextAreaElement;
export const copyScriptBtn = getEl('copy-script-btn') as HTMLButtonElement;
export const generateFinalTakeBtn = getEl('generate-final-take-btn') as HTMLButtonElement;
export const finalTakeDisplay = getEl('final-take-display');
export const finalTakeImage = getEl('final-take-image') as HTMLImageElement;
export const postGenerationActions = getEl('post-generation-actions');
export const finalTakeActions = getEl('final-take-actions');
export const downloadFinalTakeLink = getEl('download-final-take-link') as HTMLAnchorElement;

// Add Text Inputs
export const addTextInput = getEl('add-text-input') as HTMLInputElement;
export const improveTextBtn = getEl('improve-text-btn') as HTMLButtonElement;
export const applyTextBtn = getEl('apply-text-btn') as HTMLButtonElement;
export const quickAddTextInput = getEl('quick-add-text-input') as HTMLInputElement;
export const quickImproveTextBtn = getEl('quick-improve-text-btn') as HTMLButtonElement;
export const quickApplyTextBtn = getEl('quick-apply-text-btn') as HTMLButtonElement;

// Quick Creation
export const simplePromptTextarea = getEl('simple-prompt-textarea') as HTMLTextAreaElement;
export const improvePromptBtn = getEl('improve-prompt-btn') as HTMLButtonElement;
export const structurePromptBtn = getEl('structure-prompt-btn') as HTMLButtonElement;
export const simpleImageUploadsContainer = getEl('simple-image-uploads');
export const quickGenerateImageBtn = getEl('quick-generate-image-btn') as HTMLButtonElement;
export const quickEditImageUploadsContainer = getEl('quick-edit-image-uploads');

// Quick Creation Toggle
export const quickCreationHeader = getEl('quick-creation-header');
export const toggleQuickCreationBtn = getEl('toggle-quick-creation-btn');
export const quickCreationContent = getEl('quick-creation-content');
export const quickCreationChevronUp = getEl('quick-creation-chevron-up');
export const quickCreationChevronDown = getEl('quick-creation-chevron-down');

// Quick Creation Result Panel
export const quickCreationResultPanel = getEl('quick-creation-result-panel');
export const quickCreationResultHeader = getEl('quick-creation-result-header');
export const quickCreationResultContent = getEl('quick-creation-result-content');
export const quickFinalImageDisplay = getEl('quick-final-image-display');
export const quickFinalImage = getEl('quick-final-image') as HTMLImageElement;
export const quickImagePlaceholder = getEl('quick-image-placeholder');
export const quickHistoryPanel = getEl('quick-history-panel');
export const quickVersionHistoryContainer = getEl('quick-version-history-container');
export const quickPostGenerationActions = getEl('quick-post-generation-actions');
export const quickCaptionBtn = getEl('quick-caption-btn') as HTMLButtonElement;
export const quickDownloadLink = getEl('quick-download-link') as HTMLAnchorElement;


// Quick Editions
export const toggleQuickEditionsBtn = getEl('toggle-quick-editions-btn');
export const quickEditionsPanel = getEl('quick-editions-panel');
export const quickEditionsChevron = getEl('quick-editions-chevron');
export const quickFormatSelector = getEl('quick-format-selector');
export const quickEditPrompt = getEl('quick-edit-prompt') as HTMLInputElement;
export const quickRegenerateBtn = getEl('quick-regenerate-btn') as HTMLButtonElement;
export const quickSuggestBtn = getEl('quick-suggest-btn') as HTMLButtonElement;
export const quickSuggestionsList = getEl('quick-suggestions-list');
export const quickVariationBtn = getEl('quick-variation-btn') as HTMLButtonElement;
export const quickFixCharacterBtn = getEl('quick-fix-character-btn') as HTMLButtonElement;
export const quickUpscaleBtn = getEl('quick-upscale-btn') as HTMLButtonElement;
export const quickMagicEditBtn = getEl('quick-magic-edit-btn') as HTMLButtonElement;

// Structured Prompt Modal
export const structuredPromptModal = getEl('structured-prompt-modal');
export const structuredPromptLoader = getEl('structured-prompt-loader');
export const structuredPromptForm = getEl('structured-prompt-form');
export const structuredPromptCancelBtn = getEl('structured-prompt-cancel-btn');
export const structuredPromptConfirmBtn = getEl('structured-prompt-confirm-btn');

// New DOM elements
export const saveProjectBtn = getEl('save-project-btn') as HTMLButtonElement;
export const loadProjectsBtn = getEl('load-projects-btn') as HTMLButtonElement;
export const loadProjectModal = getEl('load-project-modal');
export const projectList = getEl('project-list');
export const loadProjectCloseBtn = getEl('load-project-close-btn');

export const magicEditBtn = getEl('magic-edit-btn') as HTMLButtonElement;
export const magicEditModal = getEl('magic-edit-modal');
export const magicEditCanvas = getEl('magic-edit-canvas') as HTMLCanvasElement;
export const magicEditPrompt = getEl('magic-edit-prompt') as HTMLTextAreaElement;
export const brushSizeSlider = getEl('brush-size') as HTMLInputElement;
export const magicEditCancelBtn = getEl('magic-edit-cancel-btn');
export const magicEditConfirmBtn = getEl('magic-edit-confirm-btn');

// New DOM elements for character library
export const characterLibraryBtn = getEl('character-library-btn') as HTMLButtonElement;
export const characterLibraryModal = getEl('character-library-modal');
export const characterList = getEl('character-list');
export const characterLibraryCloseBtn = getEl('character-library-close-btn');
export const characterFilterPinned = getEl('character-filter-pinned') as HTMLInputElement;
export const characterFilterFavorites = getEl('character-filter-favorites') as HTMLInputElement;
export const newSaveCharacterBtn = getEl('new-save-character-btn') as HTMLButtonElement;
export const saveCharacterPlaceholder = getEl('save-character-placeholder');

// New DOM elements for save character modal
export const saveCharacterModal = getEl('save-character-modal');
export const saveCharacterNameInput = getEl('save-character-name-input') as HTMLInputElement;
export const saveCharacterConfirmBtn = getEl('save-character-confirm-btn') as HTMLButtonElement;
export const saveCharacterCancelBtn = getEl('save-character-cancel-btn') as HTMLButtonElement;