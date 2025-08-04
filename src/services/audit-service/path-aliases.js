const path = require('path');
require('module-alias').addAliases({
  '@shared': path.join(__dirname, '../../shared'),
  '@shared/database': path.join(__dirname, '../../shared/infrastructure/database'),
  '@shared/infrastructure': path.join(__dirname, '../../shared/infrastructure')
});
