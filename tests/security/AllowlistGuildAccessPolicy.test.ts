import { AllowlistGuildAccessPolicy } from '../../src/security/AllowlistGuildAccessPolicy';

describe('AllowlistGuildAccessPolicy', () => {
  it('sem IDs: libera qualquer servidor e não está restrito', () => {
    const policy = new AllowlistGuildAccessPolicy([]);
    expect(policy.restricted).toBe(false);
    expect(policy.isAllowed('qualquer')).toBe(true);
  });

  it('com IDs: libera só os listados', () => {
    const policy = new AllowlistGuildAccessPolicy(['111', '222']);
    expect(policy.restricted).toBe(true);
    expect(policy.isAllowed('111')).toBe(true);
    expect(policy.isAllowed('222')).toBe(true);
    expect(policy.isAllowed('333')).toBe(false);
  });
});
