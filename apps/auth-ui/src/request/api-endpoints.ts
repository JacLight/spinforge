export const appEndpoints = {
  // Authentication endpoints
  login: {
    name: 'login',
    method: 'post',
    path: 'profile/user/signin',
  },
  login_magic_link: {
    name: 'login_magic_link',
    method: 'get',
    path: 'profile/user/magic-link',
  },
  refresh_token: {
    name: 'refresh_token',
    method: 'post',
    path: 'profile/user/refresh',
  },
  forgot_password: {
    name: 'forgot_password',
    method: 'post',
    path: 'profile/user/password/forgot',
  },
  register: {
    name: 'register',
    method: 'post',
    path: 'profile/user/signup',
  },
  update_user: {
    name: 'update_user',
    method: 'post',
    path: 'profile/user/update',
  },
  password_change: {
    name: 'password_change',
    method: 'post',
    path: 'profile/user/password/change',
  },
  password_reset: {
    name: 'password_reset',
    method: 'post',
    path: 'profile/user/password/reset',
  },
  profile: {
    name: 'profile',
    method: 'post',
    path: 'profile',
  },
  
  // OAuth endpoints
  facebook_login: {
    name: 'facebook_login',
    method: 'get',
    path: 'profile/facebook/url',
  },
  github_login: {
    name: 'github_login',
    method: 'get',
    path: 'profile/github/url',
  },
  google_login: {
    name: 'google_login',
    method: 'get',
    path: 'profile/google/url',
  },
  
  // OAuth2 endpoints
  oauth2_authorize: {
    name: 'oauth2_authorize',
    method: 'post',
    path: 'oauth2/authorize',
  },
  oauth2_token: {
    name: 'oauth2_token',
    method: 'post',
    path: 'oauth2/token',
  },
  
  // Organization management
  get_org: {
    name: 'get_org',
    method: 'get',
    path: 'repository/org',
  },
  get_org_by_email: {
    name: 'get_org_by_email',
    method: 'get',
    path: 'repository/org/user',
  },
  
  // Basic CRUD operations (minimal subset for auth)
  get: {
    name: 'get',
    method: 'get',
    path: 'repository/get',
  },
  create: {
    name: 'create',
    method: 'put',
    path: 'repository/create',
  },
  update: {
    name: 'update',
    method: 'post',
    path: 'repository/update',
  },
  delete: {
    name: 'delete',
    method: 'del',
    path: 'repository/delete',
  },
  find: {
    name: 'find',
    method: 'post',
    path: 'repository/find',
  },
  find_by_attribute: {
    name: 'find_by_attribute',
    method: 'get',
    path: 'repository/find-by-attribute',
  },
  isunique: {
    name: 'isunique',
    method: 'get',
    path: 'repository/isunique',
  },
  find_any_id: {
    name: 'find_any_id',
    method: 'post',
    path: 'repository/find-any-id',
  },
  delete_bulk: {
    name: 'delete_bulk',
    method: 'post',
    path: 'repository/delete',
  },
  search: {
    name: 'search',
    method: 'post',
    path: 'repository/search',
  },
  
  // File operations (minimal subset)
  file_upload: {
    name: 'file_upload',
    method: 'post',
    path: 'repository/file/upload',
  },
  file_get: {
    name: 'file_get',
    method: 'post',
    path: 'repository/file',
  },
  file_delete: {
    name: 'file_delete',
    method: 'post',
    path: 'repository/file/delete',
  },
};