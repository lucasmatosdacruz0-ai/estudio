// FIX: Define and export components and state to be used throughout the application.
export const components = {
    char: { title: 'Personagem' },
    bg: { title: 'Cenário' },
    cloth: { title: 'Roupa' },
    acc: { title: 'Acessório' },
    prod: { title: 'Produto' },
    ref: { title: 'Referência de Estilo' }
};

// Define a more specific type for the state for better type checking
interface ComponentState {
    image: string | null;
    text: string;
}

interface CharacterState extends ComponentState {
    framing: string;
}

interface Version {
    base64: string;
    prompt: string;
}

interface AppState {
    [key: string]: any; // For dynamic access like state[id]
    isGenerating: boolean;
    generationController: AbortController | null;
    
    char: CharacterState;
    bg: ComponentState;
    cloth: ComponentState;
    acc: ComponentState;
    prod: ComponentState;
    ref: { image: string | null };
    
    newChar: { image: string | null };
    pose: { image: string | null };

    basePrompt: string;
    format: string;
    lockedCharacterImage: string | null;
    versionHistory: Version[];
    
    inspirationImage: string | null;
    
    simpleImages: (string | null)[];
    quickEditImages: (string | null)[];
    quickVersionHistory: Version[];
    quickCreationResult: { base64: string | null; prompt: string };

    currentModalType: string;
    modalImageBase64: string | null;
    
    savedCharacters: any[];

    sound: {
        contextStarted: boolean;
        muted: boolean;
        volume: number;
    };
}


export const state: AppState = {
    isGenerating: false,
    generationController: null,
    
    char: { image: null, text: '', framing: 'de corpo inteiro' },
    bg: { image: null, text: '' },
    cloth: { image: null, text: '' },
    acc: { image: null, text: '' },
    prod: { image: null, text: '' },
    ref: { image: null },
    
    newChar: { image: null },
    pose: { image: null },

    basePrompt: '',
    format: '1:1',
    lockedCharacterImage: null,
    versionHistory: [],
    
    inspirationImage: null,
    
    simpleImages: [null, null, null],
    quickEditImages: [null, null, null],
    quickVersionHistory: [],
    quickCreationResult: { base64: null, prompt: '' },

    currentModalType: '',
    modalImageBase64: null,
    
    savedCharacters: [],

    sound: {
        contextStarted: false,
        muted: false,
        volume: 0.5
    }
};