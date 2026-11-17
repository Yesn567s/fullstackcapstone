const bcrypt = require('bcrypt');
const { verifyPassword } = require('../src/utils/passwords');

describe('PHP password hash compatibility', () => {
  test('verifies PHP bcrypt hashes with the $2y$ prefix', async () => {
    const nodeHash = await bcrypt.hash('migration-test', 4);
    const phpHash = nodeHash.replace(/^\$2b\$/, '$2y$');

    await expect(verifyPassword('migration-test', phpHash)).resolves.toBe(true);
    await expect(verifyPassword('wrong-password', phpHash)).resolves.toBe(false);
  });
});
