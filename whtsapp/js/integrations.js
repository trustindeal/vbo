(function () {
    const token = localStorage.getItem("vbonotif_token");
    if (!token) {
        window.location.href = "index.html";
        return;
    }

    document.querySelectorAll("[data-tab]").forEach(function (button) {
        button.addEventListener("click", function () {
            document.querySelectorAll("[data-tab]").forEach(function (item) {
                item.classList.toggle("active", item === button);
            });
            document.querySelectorAll(".integration-section").forEach(function (section) {
                section.classList.toggle("active", section.id === button.dataset.tab);
            });
        });
    });

    const templateSelect = document.getElementById("apiTemplate");
    const languageInput = document.getElementById("apiLanguage");
    const apiKeyInput = document.getElementById("urlApiKey");
    const generatedUrl = document.getElementById("generatedRequest");
    const copyUrlButton = document.getElementById("copyGeneratedUrl");

    let approvedTemplates = [];


    const loadButton = document.createElement("button");
    loadButton.type = "button";
    loadButton.className = "integration-button";
    loadButton.textContent = "Load Approved Templates";
    templateSelect.insertAdjacentElement("afterend", loadButton);

    loadButton.addEventListener("click", async function () {
        const key = apiKeyInput.value.trim();
        const clientId = "VBO Organiser";
        if (!key || !clientId) {
            alert("Enter your API key and ensure your dashboard client ID is available.");
            return;
        }
        loadButton.disabled = true;
        try {
            const response = await fetch("https://app.vbo.co.in/api/v1/whatsapp/public/templates", {
                headers: { "X-Client-ID": "VBO Organiser", "X-API-Key": key }
            });
            const raw = await response.text();
            let data;
            try { data = JSON.parse(raw); } catch { data = { detail: raw }; }
            if (!response.ok) throw new Error("HTTP " + response.status + ": " + (data.detail || raw || "Could not load templates."));
            approvedTemplates = Array.isArray(data) ? data : (data.templates || data.data?.templates || []);
            templateSelect.innerHTML = "";
            approvedTemplates.forEach(function (item) {
                const option = document.createElement("option");
                option.value = item.template_name || item.name || "";
                option.textContent = (item.template_name || item.name || "Template") +
                    " (" + (item.language || "") + ")";
                option.dataset.language = item.language || item.language_code || "";
                templateSelect.appendChild(option);
            });
            if (!approvedTemplates.length) throw new Error("No approved templates were returned.");
            languageInput.value = templateSelect.selectedOptions[0].dataset.language || "";
        } catch (error) {
            templateSelect.innerHTML = '<option value="">Template loading failed</option>';
            alert(error.message);
        } finally {
            loadButton.disabled = false;
        }
    });

    templateSelect.addEventListener("change", function () {
        languageInput.value = templateSelect.selectedOptions[0]?.dataset.language || "";
    });

    document.getElementById("generateRequest").addEventListener("click", function () {
        const template = templateSelect.value;
        const language = languageInput.value.trim();
        const key = apiKeyInput.value.trim();
        const clientId = "VBO Organiser";
        const recipients = document.getElementById("apiRecipients").value
            .split(",").map(function (value) { return value.trim(); }).filter(Boolean);

        if (!template || !language || !key || !clientId || recipients.length === 0) {
            alert("Load approved templates, enter the API key and at least one recipient.");
            return;
        }
        if (recipients.length !== 1) {
            alert("Browser URL mode supports one recipient per URL. Use the API request for multiple recipients.");
            return;
        }

        const url = new URL("https://app.vbo.co.in/api/v1/whatsapp/public/send-template");
        url.searchParams.set("template_name", template);
        url.searchParams.set("language", language);
        url.searchParams.set("recipients", recipients[0]);
        url.searchParams.set("api_key", key);
        url.searchParams.set("client_id", clientId);

        generatedUrl.value = url.toString();
        copyUrlButton.disabled = false;
    });

    copyUrlButton.addEventListener("click", async function () {
        if (!generatedUrl.value) return;
        try {
            await navigator.clipboard.writeText(generatedUrl.value);
            alert("URL copied. Treat it like a password.");
        } catch (error) {
            generatedUrl.focus();
            generatedUrl.select();
            alert("Press Ctrl+C to copy the URL.");
        }
    });
    const keyButton = document.getElementById("generateApiKey");
    const keyOutput = document.getElementById("generatedApiKey");
    const keyStatus = document.getElementById("apiKeyStatus");
    const copyKeyButton = document.getElementById("copyApiKey");

    if (keyButton && keyOutput && keyStatus && copyKeyButton) {
        keyButton.addEventListener("click", async function () {
            const confirmed = await window.VBOUI.confirm(
                "Regenerating your API key immediately invalidates the current key. Continue?"
            );
            if (!confirmed) return;

            keyButton.disabled = true;
            copyKeyButton.disabled = true;
            keyOutput.value = "";
            keyStatus.textContent = "Generating API key…";

            try {
                const response = await fetch(
                    "https://app.vbo.co.in/api/v1/whatsapp/public/client/api-key/regenerate",
                    {
                        method: "POST",
                        headers: {
                            "Authorization": "Bearer " + token,
                            "Accept": "application/json"
                        }
                    }
                );
                const data = await response.json().catch(function () { return {}; });
                if (!response.ok) {
                    throw new Error(data.detail || "Could not generate API key.");
                }
                if (!data.api_key) throw new Error("Server response did not contain an API key.");

                keyOutput.value = data.api_key;
                keyStatus.textContent = "Key generated. Copy it now; it will not be shown again.";
                copyKeyButton.disabled = false;
            } catch (error) {
                keyStatus.textContent = error.message || "API key generation failed.";
            } finally {
                keyButton.disabled = false;
            }
        });

        copyKeyButton.addEventListener("click", async function () {
            if (!keyOutput.value) return;
            try {
                await navigator.clipboard.writeText(keyOutput.value);
                keyStatus.textContent = "API key copied. Store it securely.";
            } catch (error) {
                keyOutput.focus();
                keyOutput.select();
                keyStatus.textContent = "Automatic copy unavailable. Press Ctrl+C to copy the selected key.";
            }
        });
    }
    document.getElementById("logoutButton").addEventListener("click", async function () {
        try {
            await fetch("https://app.vbo.co.in/api/v1/auth/logout?token=" + encodeURIComponent(token), {
                method: "POST"
            });
        } catch (error) {
            console.error("Logout error:", error);
        }
        localStorage.removeItem("vbonotif_token");
        localStorage.removeItem("vbonotif_client");
        window.location.href = "index.html";
    });
})();
