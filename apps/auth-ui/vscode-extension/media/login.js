// Login page JavaScript
(function() {
    // Elements
    const emailStep = document.getElementById('email-step');
    const credentialsStep = document.getElementById('credentials-step');
    const emailInput = document.getElementById('email');
    const emailDisplay = document.getElementById('email-display');
    const orgIdInput = document.getElementById('orgId');
    const passwordInput = document.getElementById('password');
    const continueBtn = document.getElementById('continue-btn');
    const backBtn = document.getElementById('back-btn');
    const magicLinkBtn = document.getElementById('magic-link-btn');
    const loginForm = document.getElementById('login-form');
    const errorMessage = document.getElementById('error-message');
    const successMessage = document.getElementById('success-message');
    const cancelBtn = document.getElementById('cancel-btn');
    const facebookBtn = document.getElementById('facebook-btn');
    const githubBtn = document.getElementById('github-btn');

    // State
    let currentEmail = '';
    let isLoading = false;

    // Helper functions
    function showError(message) {
        errorMessage.textContent = message;
        errorMessage.style.display = 'block';
        successMessage.style.display = 'none';
        setTimeout(() => {
            errorMessage.style.display = 'none';
        }, 5000);
    }

    function showSuccess(message) {
        successMessage.textContent = message;
        successMessage.style.display = 'block';
        errorMessage.style.display = 'none';
    }

    function setLoading(loading) {
        isLoading = loading;
        const buttons = document.querySelectorAll('button');
        buttons.forEach(btn => {
            btn.disabled = loading;
            if (loading) {
                btn.classList.add('loading');
            } else {
                btn.classList.remove('loading');
            }
        });
    }

    function validateEmail(email) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    }

    async function checkUserOrgs(email) {
        try {
            const response = await fetch(`${apiUrl}/repository/org/user/${email}`, {
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                const orgs = await response.json();
                if (Array.isArray(orgs) && orgs.length > 0) {
                    // User has organizations - we should handle this
                    // For now, we'll just proceed to credentials
                    return false;
                }
            }
            return false;
        } catch (error) {
            console.error('Error checking organizations:', error);
            return false;
        }
    }

    // Event handlers
    continueBtn.addEventListener('click', async () => {
        const email = emailInput.value.trim();
        
        if (!email) {
            showError('Please enter your email');
            return;
        }

        if (!validateEmail(email)) {
            showError('Please enter a valid email');
            return;
        }

        currentEmail = email;
        emailDisplay.value = email;

        setLoading(true);
        const hasOrgs = await checkUserOrgs(email);
        setLoading(false);

        if (!hasOrgs) {
            // Show credentials step
            emailStep.style.display = 'none';
            credentialsStep.style.display = 'block';
            orgIdInput.focus();
        }
    });

    backBtn.addEventListener('click', () => {
        credentialsStep.style.display = 'none';
        emailStep.style.display = 'block';
        errorMessage.style.display = 'none';
        emailInput.focus();
    });

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const orgId = orgIdInput.value.trim();
        const password = passwordInput.value;

        if (!orgId) {
            showError('Site name is required');
            return;
        }

        if (!password) {
            showError('Password is required');
            return;
        }

        setLoading(true);

        try {
            const response = await fetch(`${apiUrl}/profile/user/signin`, {
                method: 'POST',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json',
                    'orgid': orgId
                },
                body: JSON.stringify({
                    email: currentEmail,
                    password: password
                })
            });

            const data = await response.json();

            if (response.ok && data.token) {
                showSuccess('Login successful!');
                
                // Send auth data back to extension
                vscode.postMessage({
                    command: 'login-success',
                    authData: {
                        isAuthenticated: true,
                        orgId,
                        ...data
                    }
                });
            } else {
                showError(data.message || data.error || 'Login failed. Please check your credentials.');
            }
        } catch (error) {
            console.error('Login error:', error);
            showError('Login failed. Please check your connection and try again.');
        } finally {
            setLoading(false);
        }
    });

    magicLinkBtn.addEventListener('click', async () => {
        const email = emailInput.value.trim();
        
        if (!email) {
            showError('Please enter your email');
            return;
        }

        if (!validateEmail(email)) {
            showError('Please enter a valid email');
            return;
        }

        setLoading(true);

        try {
            const response = await fetch(`${apiUrl}/profile/user/magic-link?email=${encodeURIComponent(email)}`, {
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                showSuccess('Magic link sent to your email!');
            } else {
                const data = await response.json();
                showError(data.message || 'Failed to send magic link');
            }
        } catch (error) {
            console.error('Magic link error:', error);
            showError('Failed to send magic link. Please try again.');
        } finally {
            setLoading(false);
        }
    });

    cancelBtn.addEventListener('click', () => {
        vscode.postMessage({ command: 'cancel' });
    });

    // Social login handlers
    facebookBtn.addEventListener('click', async () => {
        try {
            const response = await fetch(`${apiUrl}/profile/facebook/url`);
            const data = await response.json();
            if (data.authUrl) {
                // Open in external browser
                window.open(data.authUrl, '_blank');
                showSuccess('Please complete login in your browser');
            }
        } catch (error) {
            showError('Facebook login is not available');
        }
    });

    githubBtn.addEventListener('click', async () => {
        try {
            const response = await fetch(`${apiUrl}/profile/github/url`);
            const data = await response.json();
            if (data.authUrl) {
                // Open in external browser
                window.open(data.authUrl, '_blank');
                showSuccess('Please complete login in your browser');
            }
        } catch (error) {
            showError('GitHub login is not available');
        }
    });

    // Links
    document.getElementById('forgot-password').addEventListener('click', (e) => {
        e.preventDefault();
        showError('Password recovery not available in VS Code. Please visit the website.');
    });

    document.getElementById('sign-up').addEventListener('click', (e) => {
        e.preventDefault();
        showError('Registration not available in VS Code. Please visit the website.');
    });

    // Initialize
    emailInput.focus();

    // Handle enter key
    emailInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            continueBtn.click();
        }
    });
})();