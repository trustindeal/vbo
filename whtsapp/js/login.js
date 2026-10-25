const loginForm = document.getElementById("loginForm");
const loginButton = document.getElementById("loginButton");
const loginMessage = document.getElementById("loginMessage");

loginForm.addEventListener("submit", async function (event) {
    event.preventDefault();

    const username = document.getElementById("username").value.trim();
    const password = document.getElementById("password").value;

    if (!username || !password) {
        loginMessage.textContent = "Username and password are required.";
        return;
    }

    loginButton.disabled = true;
    loginButton.textContent = "Logging in...";
    loginMessage.textContent = "";

    try {
        const response = await fetch("https://app.vbo.co.in/api/v1/auth/login", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                username: username,
                password: password
            })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.detail || "Invalid username or password.");
        }

        localStorage.setItem("vbonotif_token", data.token);
        localStorage.setItem("vbonotif_client", data.client_name);

        loginMessage.textContent = "Login successful.";
        loginMessage.className = "login-message success";

        window.location.href = "inbox.html";

    } catch (error) {
        loginMessage.textContent = error.message;
        loginMessage.className = "login-message error";
    } finally {
        loginButton.disabled = false;
        loginButton.textContent = "Login";
    }
});

const togglePassword = document.getElementById("togglePassword");
const passwordInput = document.getElementById("password");

togglePassword.addEventListener("click", function () {
    const isPassword = passwordInput.type === "password";
    passwordInput.type = isPassword ? "text" : "password";
    togglePassword.textContent = isPassword
        ? String.fromCodePoint(0x1F648)
        : String.fromCodePoint(0x1F441);
    togglePassword.setAttribute(
        "aria-label",
        isPassword ? "Hide password" : "Show password"
    );
});
