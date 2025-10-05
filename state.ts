export const components = {
    char: { title: 'Personagem (Obrigatório)' },
    ref: { title: 'Referência' },
    bg: { title: 'Cenário' },
    cloth: { title: 'Roupa' },
    acc: { title: 'Acessório' },
    prod: { title: 'Produto' }
};

export const state: any = {
    char: { image: null, text: '', framing: 'de corpo inteiro' },
    ref: { image: null, text: '' },
    bg: { image: null, text: '' },
    cloth: { image: null, text: '' },
    acc: { image: null, text: '' },
    prod: { image: null, text: '' },
    pose: { image: null },
    newChar: { image: null },
    inspirationImage: null,
    format: '1:1',
    versionHistory: [],
    isGenerating: false,
    basePrompt: '',
    currentModalType: null,
    modalImageBase64: null,
    lockedCharacterImage: null,
    savedCharacters: [],
    sound: {
        muted: false,
        volume: 0.5,
        contextStarted: false
    }
};