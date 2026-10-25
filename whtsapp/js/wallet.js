const token = localStorage.getItem("vbonotif_token");

if (!token) {
    window.location.href = "index.html";
}

const API_BASE = "https://app.vbo.co.in/api/v1";

let minimumRecharge = 100;
let rechargeUpiId = "";
let rechargeClientName = "VBONotif";


let rechargeHistoryPage = 1;
const RECHARGE_HISTORY_PAGE_SIZE = 5;

async function loadRechargeHistory() {
    const container = document.getElementById("rechargeHistory");
    if (!container) return;

    container.textContent = "Loading recharge history...";

    try {
        const response = await fetch(
            API_BASE + "/whatsapp/wallet/recharge-history",
            {
                headers: {
                    "Authorization": "Bearer " + token
                }
            }
        );

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.detail || "Unable to load recharge history.");
        }

        const requests = Array.isArray(data.requests) ? data.requests : [];

        if (requests.length === 0) {
            container.className = "empty-history";
            container.textContent = "No recharge transactions yet.";
            return;
        }

        container.className = "history-table-wrap";
        container.replaceChildren();

        const table = document.createElement("table");
        table.className = "history-table";

        const thead = document.createElement("thead");
        const headerRow = document.createElement("tr");

        ["Date", "Amount", "Payment Reference", "Status", "Admin Remark"].forEach(function (label) {
            const th = document.createElement("th");
            th.textContent = label;
            headerRow.appendChild(th);
        });

        thead.appendChild(headerRow);
        table.appendChild(thead);

        const totalPages = Math.ceil(requests.length / RECHARGE_HISTORY_PAGE_SIZE);
        rechargeHistoryPage = Math.min(
            Math.max(1, rechargeHistoryPage),
            totalPages
        );

        const startIndex = (rechargeHistoryPage - 1) * RECHARGE_HISTORY_PAGE_SIZE;
        const pageRequests = requests.slice(
            startIndex,
            startIndex + RECHARGE_HISTORY_PAGE_SIZE
        );

        const tbody = document.createElement("tbody");

        pageRequests.forEach(function (item) {
            const row = document.createElement("tr");

            const dateCell = document.createElement("td");
            dateCell.textContent = item.requested_at || "—";
            row.appendChild(dateCell);

            const amountCell = document.createElement("td");
            amountCell.textContent = "₹" + Number(item.amount || 0).toFixed(2);
            row.appendChild(amountCell);

            const referenceCell = document.createElement("td");
            referenceCell.textContent = item.payment_reference || "—";
            row.appendChild(referenceCell);

            const statusCell = document.createElement("td");
            const badge = document.createElement("span");
            const status = String(item.status || "pending").toLowerCase();
            badge.className = "history-status status-" +
                (["pending", "approved", "rejected"].includes(status) ? status : "unknown");
            badge.textContent = status.charAt(0).toUpperCase() + status.slice(1);
            statusCell.appendChild(badge);
            row.appendChild(statusCell);

            const remarkCell = document.createElement("td");
            remarkCell.textContent = item.remark || "—";
            row.appendChild(remarkCell);

            tbody.appendChild(row);
        });

        table.appendChild(tbody);
        container.appendChild(table);

        if (totalPages > 1) {
            const pagination = document.createElement("div");
            pagination.className = "history-pagination";

            const previousButton = document.createElement("button");
            previousButton.type = "button";
            previousButton.textContent = "Previous";
            previousButton.disabled = rechargeHistoryPage <= 1;
            previousButton.addEventListener("click", function () {
                if (rechargeHistoryPage > 1) {
                    rechargeHistoryPage--;
                    loadRechargeHistory();
                }
            });

            const pageLabel = document.createElement("span");
            pageLabel.textContent =
                "Page " + rechargeHistoryPage + " of " + totalPages;

            const nextButton = document.createElement("button");
            nextButton.type = "button";
            nextButton.textContent = "Next";
            nextButton.disabled = rechargeHistoryPage >= totalPages;
            nextButton.addEventListener("click", function () {
                if (rechargeHistoryPage < totalPages) {
                    rechargeHistoryPage++;
                    loadRechargeHistory();
                }
            });

            pagination.appendChild(previousButton);
            pagination.appendChild(pageLabel);
            pagination.appendChild(nextButton);
            container.appendChild(pagination);
        }

    } catch (error) {
        console.error("RECHARGE HISTORY ERROR:", error);
        container.className = "empty-history";
        container.textContent = "Recharge history could not be loaded. Please refresh the page.";
    }
}

async function loadWalletData() {

    try {

        const response = await fetch(
            API_BASE + "/auth/me",
            {
                headers: {
                    "Authorization": "Bearer " + token
                }
            }
        );

        if (!response.ok) {
            throw new Error("Unable to load wallet information.");
        }

        const data = await response.json();

        const clientName =
            data.client_name ||
            localStorage.getItem("vbonotif_client") ||
            "Client";

        rechargeClientName = clientName;

        document.getElementById("clientName").textContent =
            clientName;

        const wallet = data.wallet || {};
        const pricing = data.pricing || {};
        const recharge = data.recharge || {};

        rechargeUpiId = recharge.upi_id || "";

        const balance =
            Number(wallet.balance || 0);

        document.getElementById("walletBalance").textContent =
            "₹" + balance.toFixed(2);

        const validTill =
            wallet.valid_till;

        document.getElementById("walletValidity").textContent =
            "Valid till: " +
            (validTill && window.VBOTime
                ? window.VBOTime.date(validTill)
                : validTill || "Not set");

        const textRate =
            Number(pricing.text_message || 0);

        const templateRate =
            Number(pricing.template_message || 0);

        document.getElementById("textMessageRate").textContent =
            "₹" + textRate.toFixed(2);

        document.getElementById("templateMessageRate").textContent =
            "₹" + templateRate.toFixed(2);

        minimumRecharge =
            Number(recharge.minimum_amount || 0);

        document.getElementById("minimumRecharge").textContent =
            "₹" + minimumRecharge.toFixed(2);

        const validityDays =
            recharge.validity_days;

        document.getElementById("rechargeValidity").textContent =
            validityDays
                ? validityDays + " days"
                : "Not set";

        document.getElementById("rechargeMinimumText").textContent =
            "Minimum recharge: ₹" +
            minimumRecharge.toFixed(2);

        document.getElementById("rechargeUpiId").textContent =
            recharge.upi_id ||
            "Not configured";

        document.getElementById("rechargeInstructions").textContent =
            recharge.payment_instructions ||
            "Payment instructions are not configured yet.";

        document.getElementById("messagesToday").textContent =
            "Loading...";

        document.getElementById("totalMessages").textContent =
            "Loading...";

        document.getElementById("totalSpent").textContent = "-";

        try {
            const usageResponse = await fetch(
                API_BASE + "/whatsapp/wallet/usage-summary",
                {
                    headers: {
                        "Authorization": "Bearer " + token
                    }
                }
            );

            if (!usageResponse.ok) {
                throw new Error("Unable to load usage summary.");
            }

            const usage = await usageResponse.json();

            document.getElementById("messagesToday").textContent =
                Number(usage.messages_today || 0).toLocaleString();

            document.getElementById("totalMessages").textContent =
                Number(usage.total_messages || 0).toLocaleString();

            document.getElementById("totalSpent").textContent = "-";

        } catch (usageError) {
            console.error("WALLET USAGE ERROR:", usageError);
            document.getElementById("messagesToday").textContent = "-";
            document.getElementById("totalMessages").textContent = "-";
            document.getElementById("totalSpent").textContent = "-";
        }

    } catch (error) {

        console.error("WALLET LOAD ERROR:", error);

        document.getElementById("walletBalance").textContent =
            "Unable to load";

        document.getElementById("walletValidity").textContent =
            "Unable to load wallet information.";
    }
}



function resetRechargeQr() {

    const container =
        document.getElementById("upiQrContainer");

    const amountText =
        document.getElementById("qrAmountText");

    if (!container || !amountText) {
        return;
    }

    container.innerHTML =
        '<div class="upi-qr-placeholder">Enter a recharge amount above to generate your payment QR.</div>';

    amountText.textContent =
        "Enter amount to generate QR";
}


function generateRechargeQr() {

    const amountInput =
        document.getElementById("rechargeAmount");

    const container =
        document.getElementById("upiQrContainer");

    const amountText =
        document.getElementById("qrAmountText");

    if (!amountInput || !container || !amountText) {
        return;
    }

    const amount =
        Number(amountInput.value);

    if (!amount || amount <= 0 || !rechargeUpiId) {
        resetRechargeQr();
        return;
    }

    const upiUrl =
        "upi://pay?pa=" +
        encodeURIComponent(rechargeUpiId) +
        "&pn=" +
        encodeURIComponent(rechargeClientName) +
        "&am=" +
        amount.toFixed(2) +
        "&cu=INR";

    container.innerHTML = "";

    new QRCode(container, {
        text: upiUrl,
        width: 220,
        height: 220,
        correctLevel: QRCode.CorrectLevel.M
    });

    amountText.textContent =
        "Pay ₹" + amount.toFixed(2);
}
function openRechargeModal() {

    const modal =
        document.getElementById("rechargeModal");

    const amount =
        document.getElementById("rechargeAmount");

    const reference =
        document.getElementById("paymentReference");

    const status =
        document.getElementById("rechargeModalStatus");

    amount.value = "";
    reference.value = "";

    resetRechargeQr();

    status.textContent = "";
    status.className = "modal-status hidden";

    modal.classList.remove("hidden");

    setTimeout(function () {
        amount.focus();
    }, 100);
}


function closeRechargeModal() {

    const modal =
        document.getElementById("rechargeModal");

    modal.classList.add("hidden");
}


function showRechargeStatus(message, type) {

    const status =
        document.getElementById("rechargeModalStatus");

    status.textContent = message;
    status.className =
        "modal-status " + type;
}


async function submitRecharge() {

    const amountInput =
        document.getElementById("rechargeAmount");

    const referenceInput =
        document.getElementById("paymentReference");

    const amount =
        Number(amountInput.value);

    const reference =
        referenceInput.value.trim();

    if (!amount || amount < minimumRecharge) {

        showRechargeStatus(
            "Minimum recharge amount is ₹" +
            minimumRecharge.toFixed(2) + ".",
            "error"
        );

        amountInput.focus();
        return;
    }

    if (!reference) {

        showRechargeStatus(
            "Please enter the payment reference / UTR.",
            "error"
        );

        referenceInput.focus();
        return;
    }

    const submitButton =
        document.getElementById("submitRecharge");

    submitButton.disabled = true;
    submitButton.textContent = "Submitting...";

    try {

        const response = await fetch(
            API_BASE + "/whatsapp/wallet/recharge",
            {
                method: "POST",
                headers: {
                    "Authorization": "Bearer " + token,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    amount: amount,
                    payment_reference: reference
                })
            }
        );

        const data = await response.json();

        if (!response.ok) {
            throw new Error(
                data.detail ||
                "Unable to submit recharge request."
            );
        }

        showRechargeStatus(
            "Recharge request submitted successfully. Request ID: #" +
            data.request_id,
            "success"
        );

        await loadRechargeHistory();

        submitButton.textContent = "Submitted";

        setTimeout(function () {
            closeRechargeModal();
        }, 2000);

    } catch (error) {

        console.error(
            "RECHARGE REQUEST ERROR:",
            error
        );

        showRechargeStatus(
            error.message ||
            "Unable to submit recharge request.",
            "error"
        );

        submitButton.disabled = false;
        submitButton.textContent =
            "Submit Recharge Request";
    }
}
function logout() {

    localStorage.removeItem("vbonotif_token");
    localStorage.removeItem("vbonotif_client");

    window.location.href = "index.html";
}


document
    .getElementById("rechargeAmount")
    .addEventListener(
        "input",
        generateRechargeQr
    );


document
    .getElementById("rechargeButton")
    .addEventListener(
        "click",
        openRechargeModal
    );


document
    .getElementById("closeRechargeModal")
    .addEventListener(
        "click",
        closeRechargeModal
    );


document
    .getElementById("cancelRecharge")
    .addEventListener(
        "click",
        closeRechargeModal
    );


document
    .getElementById("submitRecharge")
    .addEventListener(
        "click",
        submitRecharge
    );


document
    .getElementById("logoutButton")
    .addEventListener(
        "click",
        logout
    );


document
    .getElementById("rechargeModal")
    .addEventListener(
        "click",
        function (event) {

            if (
                event.target ===
                document.getElementById("rechargeModal")
            ) {
                closeRechargeModal();
            }

        }
    );


loadWalletData();
loadRechargeHistory();


