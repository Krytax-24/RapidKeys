const { colorSpan } = require('./script.js');

describe('colorSpan', () => {
  let mockSpan;
  let addedClasses;
  let removedClasses;

  beforeEach(() => {
    addedClasses = [];
    removedClasses = [];

    mockSpan = {
      classList: {
        add: jest.fn((cls) => addedClasses.push(cls)),
        remove: jest.fn((cls) => removedClasses.push(cls))
      }
    };

    global.document = {
      getElementById: jest.fn((id) => {
        if (id === 'test-id') return mockSpan;
        return null;
      })
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('adds correct class and removes wrong and current classes when color is 1', () => {
    colorSpan('test-id', 1);

    expect(global.document.getElementById).toHaveBeenCalledWith('test-id');
    expect(mockSpan.classList.add).toHaveBeenCalledWith('correct');
    expect(mockSpan.classList.remove).toHaveBeenCalledWith('wrong');
    expect(mockSpan.classList.remove).toHaveBeenCalledWith('current');

    expect(addedClasses).toContain('correct');
    expect(removedClasses).toContain('wrong');
    expect(removedClasses).toContain('current');
  });

  test('adds current class and removes correct and wrong classes when color is 2', () => {
    colorSpan('test-id', 2);

    expect(global.document.getElementById).toHaveBeenCalledWith('test-id');
    expect(mockSpan.classList.add).toHaveBeenCalledWith('current');
    expect(mockSpan.classList.remove).toHaveBeenCalledWith('correct');
    expect(mockSpan.classList.remove).toHaveBeenCalledWith('wrong');

    expect(addedClasses).toContain('current');
    expect(removedClasses).toContain('correct');
    expect(removedClasses).toContain('wrong');
  });

  test('adds wrong class and removes correct and current classes when color is 3', () => {
    colorSpan('test-id', 3);

    expect(global.document.getElementById).toHaveBeenCalledWith('test-id');
    expect(mockSpan.classList.add).toHaveBeenCalledWith('wrong');
    expect(mockSpan.classList.remove).toHaveBeenCalledWith('correct');
    expect(mockSpan.classList.remove).toHaveBeenCalledWith('current');

    expect(addedClasses).toContain('wrong');
    expect(removedClasses).toContain('correct');
    expect(removedClasses).toContain('current');
  });
});
