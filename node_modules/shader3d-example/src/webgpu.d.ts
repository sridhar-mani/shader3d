/// <reference types="@webgpu/types" />

// Augment Navigator with GPU
declare global {
  interface Navigator {
    readonly gpu: GPU
  }
}

export {}
