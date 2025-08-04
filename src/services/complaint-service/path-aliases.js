const moduleAlias = require('module-alias');

moduleAlias.addAliases({
  '@shared': __dirname + '/../../shared',
  '@shared/database': __dirname + '/../../shared/infrastructure/database',
  '@shared/infrastructure': __dirname + '/../../shared/infrastructure'
});