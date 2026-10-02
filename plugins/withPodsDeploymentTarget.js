/**
 * Aligne la version minimale d'iOS de tous les pods sur celle de l'app.
 *
 * Xcode 27 refuse d'archiver une cible dont IPHONEOS_DEPLOYMENT_TARGET est
 * inférieur à 15.0. Trois pods en déclarent une plus ancienne (RNCAsyncStorage
 * 13.4, RNSVGFilters 12.4, SDWebImage 9.0) : on les relève à 15.1 dans le
 * post_install du Podfile généré.
 */
const fs = require('fs');
const path = require('path');
const { withDangerousMod } = require('expo/config-plugins');

const TARGET = '15.1';
const MARKER = '# withPodsDeploymentTarget';

const SNIPPET = `
    ${MARKER}
    installer.pods_project.targets.each do |t|
      t.build_configurations.each do |c|
        current = c.build_settings['IPHONEOS_DEPLOYMENT_TARGET']
        if current.nil? || current.to_f < ${TARGET}
          c.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = '${TARGET}'
        end
      end
    end
`;

module.exports = function withPodsDeploymentTarget(config) {
  return withDangerousMod(config, [
    'ios',
    (cfg) => {
      const podfile = path.join(cfg.modRequest.platformProjectRoot, 'Podfile');
      let contents = fs.readFileSync(podfile, 'utf8');
      if (!contents.includes(MARKER)) {
        const anchor = /post_install do \|installer\|\n/;
        if (!anchor.test(contents)) {
          throw new Error('withPodsDeploymentTarget : bloc post_install introuvable dans le Podfile');
        }
        contents = contents.replace(anchor, (m) => m + SNIPPET);
        fs.writeFileSync(podfile, contents);
      }
      return cfg;
    },
  ]);
};
