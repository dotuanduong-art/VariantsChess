import { GameState, Color } from 'game-core';

describe('Game Core State Serialization & Rollback Safety Tests', () => {
  it('should perfectly preserve complex types in variantState after serialize/deserialize', () => {
    const state = new GameState();
    
    // Setup variantState with diverse and complex javascript types
    state.variantState = {
      simpleNum: 42,
      simpleString: 'hello',
      simpleBool: true,
      undefinedVal: undefined,
      infinityPositive: Infinity,
      infinityNegative: -Infinity,
      nanValue: NaN,
      testDate: new Date('2026-07-09T00:00:00.000Z'),
      testSet: new Set([1, 2, 3, 'a']),
      testMap: new Map([
        ['key1', 'value1'],
        ['key2', 999],
      ]),
      nestedObj: {
        arrayVal: [10, 20],
        someSet: new Set([100]),
      }
    };

    // Serialize
    const serialized = state.toSerializable();

    // Deserialize/Restore
    const restored = GameState.fromSerializable(serialized);

    // Verify restored keys and values match exactly
    const restoredState = restored.variantState;

    expect(restoredState.simpleNum).toBe(42);
    expect(restoredState.simpleString).toBe('hello');
    expect(restoredState.simpleBool).toBe(true);
    expect(restoredState.undefinedVal).toBeUndefined();
    expect(restoredState.infinityPositive).toBe(Infinity);
    expect(restoredState.infinityNegative).toBe(-Infinity);
    expect(restoredState.nanValue).toBeNaN();
    expect(restoredState.testDate.constructor.name).toBe('Date');
    expect((restoredState.testDate as Date).getTime()).toBe(new Date('2026-07-09T00:00:00.000Z').getTime());
    
    // Set checking
    expect(restoredState.testSet.constructor.name).toBe('Set');
    expect((restoredState.testSet as Set<any>).has(1)).toBe(true);
    expect((restoredState.testSet as Set<any>).has('a')).toBe(true);
    
    // Map checking
    expect(restoredState.testMap.constructor.name).toBe('Map');
    expect((restoredState.testMap as Map<any, any>).get('key1')).toBe('value1');
    expect((restoredState.testMap as Map<any, any>).get('key2')).toBe(999);

    // Nested checks
    expect(restoredState.nestedObj.arrayVal).toEqual([10, 20]);
    expect(restoredState.nestedObj.someSet.constructor.name).toBe('Set');
    expect((restoredState.nestedObj.someSet as Set<any>).has(100)).toBe(true);
  });
});
