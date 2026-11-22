const token = localStorage.getItem("vbonotif_token");
const API_BASE = "https://app.vbo.co.in/api/v1";

if (!token) {
    window.location.href = "index.html";
}

async function loadDashboard() {
    try {
        const response = await fetch(API_BASE + "/auth/me", {
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

        document.getElementById("clientName").textContent = data.display_name || data.client_name;
        document.getElementById("welcomeText").textContent =
            "Welcome back, " + (data.display_name || data.client_name);

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

        document.getElementById("textRate24h").textContent =
            "₹" + Number(pricing.text_message_24h != null ? pricing.text_message_24h : pricing.text_message || 0).toFixed(2);

        document.getElementById("templateMarketingRate").textContent =
            "₹" + Number(pricing.template_marketing != null ? pricing.template_marketing : pricing.template_message || 0).toFixed(2);

        document.getElementById("templateOtherRate").textContent =
            "₹" + Number(pricing.template_other != null ? pricing.template_other : pricing.template_message || 0).toFixed(2);

        await loadMessagesToday();

    } catch (error) {
        console.error("Dashboard load error:", error);
    }
}

async function loadMessagesToday() {
    const messagesToday = document.getElementById("messagesToday");

    try {
        const response = await fetch(API_BASE + "/whatsapp/wallet/usage-summary", {
            method: "GET",
            headers: {
                "Authorization": "Bearer " + token
            },
            cache: "no-store"
        });

        if (!response.ok) {
            throw new Error("Unable to load today's message count.");
        }

        const usage = await response.json();
        messagesToday.textContent = Number(usage.messages_today || 0).toLocaleString("en-IN");
    } catch (error) {
        messagesToday.textContent = "—";
        console.error("Dashboard usage load error:", error);
    }
}

document.getElementById("logoutButton").addEventListener("click", async function () {
    try {
        await fetch(API_BASE + "/auth/logout?token=" +
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
