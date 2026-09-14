import '../server/env';
import { seedDemoData } from '../server/seedDemo';

seedDemoData()
  .then(() => {
    console.log('[Seed] Complete!');
    process.exit(0);
  })
  .catch((err) => {
    console.error('[Seed] Error:', err);
    process.exit(1);
  });
