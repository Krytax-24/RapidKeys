// setup-jest.js
global.document = {
  getElementById: jest.fn(() => ({
    addEventListener: jest.fn(),
    classList: {
      add: jest.fn(),
      remove: jest.fn()
    },
    innerText: '',
    value: '',
    style: {},
    appendChild: jest.fn(),
    innerHTML: ''
  })),
  createElement: jest.fn(() => ({
    setAttribute: jest.fn(),
    appendChild: jest.fn(),
    innerText: '',
    innerHTML: ''
  }))
};
