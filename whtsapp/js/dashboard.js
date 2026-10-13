const token = localStorage.getItem("vbonotif_token");

if (!token) {
    window.location.href = "index.html";
}

async function loadDashboard() {
    try {
        const response = await fetch("https://app.vbo.co.in/api/v1/auth/me", {
            method: "GET",
            headers: {
                "Authorization": "Bearer " + token
            }
        });

        const data = await response.json();

        if (!response.ok) {
            localStorage.removeItem("vbonotif_token");
            localStorage.removeItem("vbonotif_client");
            window.location.href = "index.html";
            return;
        }

        document.getElementById("clientName").textContent = data.client_name;
        document.getElementById("welcomeText").textContent =
            "Welcome back, " + data.client_name;

        document.getElementById("accountStatus").textContent =
            data.status === "active" ? "Active account" : data.status;

        const wallet = data.wallet || {};
        const whatsapp = data.whatsapp || {};
        const pricing = data.pricing || {};
        const bot = data.bot || {};

        document.getElementById("walletBalance").textContent =
            "₹" + Number(wallet.balance || 0).toFixed(2);

        document.getElementById("validTill").textContent =
            wallet.valid_till && window.VBOTime
                ? window.VBOTime.date(wallet.valid_till)
                : wallet.valid_till || "Not set";

        document.getElementById("botStatus").textContent =
            bot.enabled ? "Enabled" : "Disabled";

        document.getElementById("whatsappName").textContent =
            whatsapp.display_name || "WhatsApp Account";

        document.getElementById("whatsappNumber").textContent =
            whatsapp.phone_number || "Not configured";

        document.getElementById("textRate").textContent =
            "₹" + Number(pricing.text_message || 0).toFixed(2);

        document.getElementById("templateRate").textContent =
            "₹" + Number(pricing.template_message || 0).toFixed(2);

    } catch (error) {
        console.error("Dashboard load error:", error);
    }
}

document.getElementById("logoutButton").addEventListener("click", async function () {
    try {
        await fetch("https://app.vbo.co.in/api/v1/auth/logout?token=" +
            encodeURIComponent(token), {
            method: "POST"
        });
    } catch (error) {
        console.error("Logout error:", error);
    }

    localStorage.removeItem("vbonotif_token");
    localStorage.removeItem("vbonotif_client");

    window.location.href = "index.html";
});

loadDashboard();
