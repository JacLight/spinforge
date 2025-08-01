#!/bin/bash

# Fix all instances of .spinforge.localhost suffix being automatically added

echo "Fixing hardcoded .spinforge.localhost suffixes..."

# Fix in ApplicationDrawerV2.tsx
sed -i '' 's/vhost\.domain || `${vhost\.subdomain}\.spinforge\.localhost`/vhost.domain || vhost.subdomain/g' apps/admin-ui/src/components/ApplicationDrawerV2.tsx
sed -i '' 's/vhost\?\.domain || `${vhost\?\.subdomain}\.spinforge\.localhost`/vhost?.domain || vhost?.subdomain/g' apps/admin-ui/src/components/ApplicationDrawerV2.tsx

# Fix in ApplicationDetailHosting.tsx  
sed -i '' 's/`http:\/\/${vhost\.subdomain}\.spinforge\.localhost`/null/g' apps/admin-ui/src/pages/ApplicationDetailHosting.tsx
sed -i '' 's/vhost\.domain || `${vhost\.subdomain}\.spinforge\.localhost`/vhost.domain || vhost.subdomain/g' apps/admin-ui/src/pages/ApplicationDetailHosting.tsx

# Fix in AdminDashboard.tsx
sed -i '' 's/{vhost\.subdomain}\.spinforge\.localhost/{vhost.domain || vhost.subdomain}/g' apps/admin-ui/src/pages/AdminDashboard.tsx
sed -i '' 's/`http:\/\/${vhost\.subdomain}\.spinforge\.localhost`/vhost.domain ? `http:\/\/${vhost.domain}` : "#"/g' apps/admin-ui/src/pages/AdminDashboard.tsx

# Fix in Deploy.tsx (the default domain display)
sed -i '' 's/Default: {formData\.subdomain}\.spinforge\.localhost/No domain configured - site will only be accessible via subdomain/g' apps/admin-ui/src/pages/Deploy.tsx

echo "Done! All .spinforge.localhost suffixes have been removed."
echo "Sites without custom domains will now show just the subdomain."