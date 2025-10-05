import { state } from './state';
import * as dom from './dom';

declare const Tone: any;

let gainNode: any;
let synth: any;

function initializeSound() {
    if (typeof Tone !== 'undefined') {
        gainNode = new Tone.Gain(0.5).toDestination();
        synth = new Tone.Synth().connect(gainNode);
    } else {
        console.warn("Tone.js not loaded, sound will be disabled.");
    }
}

export async function startAudioContext() {
    if (!synth) return;
    if (!state.sound.contextStarted && Tone.context.state !== 'running') {
        await Tone.start();
        state.sound.contextStarted = true;
    }
}

export function playSound(note: string) {
    if (synth && state.sound.contextStarted && !state.sound.muted) {
        synth.triggerAttackRelease(note, "8n", Tone.now());
    }
}

export function toggleMute() {
    if (!gainNode) return;
    state.sound.muted = !state.sound.muted;
    dom.speakerOnIcon.classList.toggle('hidden', state.sound.muted);
    dom.speakerOffIcon.classList.toggle('hidden', !state.sound.muted);
    gainNode.gain.value = state.sound.muted ? 0 : state.sound.volume;
}

export function changeVolume(event: Event) {
    if (!gainNode) return;
    const target = event.target as HTMLInputElement;
    state.sound.volume = parseFloat(target.value);
    if (!state.sound.muted) {
        gainNode.gain.value = state.sound.volume;
    }
}

initializeSound();
