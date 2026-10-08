import { STRONG_PASSWORD_PATTERN } from './password-policy.util';
it('accepts six-character passwords with all displayed requirements',()=>{
 expect(STRONG_PASSWORD_PATTERN.test('Ab1!cd')).toBe(true);
 expect(STRONG_PASSWORD_PATTERN.test('Ab1!c')).toBe(false);
 expect(STRONG_PASSWORD_PATTERN.test('abcdef')).toBe(false);
});
