document.addEventListener("DOMContentLoaded", function () {

    const form = document.getElementById("adminLoginForm");
    const loginButton = document.getElementById("loginButton");
    const errorBox = document.getElementById("loginError");

    form.addEventListener("submit", async function (event) {

        event.preventDefault();

        errorBox.style.display = "none";
        loginButton.disabled = true;
        loginButton.textContent = "Logging in...";

        const username = document.getElementById("username").value.trim();
        const password = document.getElementById("password").value;

        try {

            const response = await fetch(
                "https://app.vbo.co.in/api/v1/whatsapp/admin/login",
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        username: username,
                        password: password
                    })
                }
            );

            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(
                    data.detail || "Invalid admin login"
                );
            }

            localStorage.setItem(
                "vbonotif_admin_token",
                data.token
            );

            localStorage.setItem(
                "vbonotif_admin_user",
                data.username
            );

            window.location.href = "admin.html";

        } catch (error) {

            errorBox.textContent = error.message;
            errorBox.style.display = "block";

            loginButton.disabled = false;
            loginButton.textContent = "Login";
        }

    });

});
