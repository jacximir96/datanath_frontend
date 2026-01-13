import apiConfig from '../../api-config.json';

export const environment = {
  production: false,
  clientName: 'MAXPOINT_LEGACY',
  ...apiConfig
};
