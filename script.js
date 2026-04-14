/* Get references to DOM elements */
const categoryFilter = document.getElementById("categoryFilter");
const productSearch = document.getElementById("productSearch");
const productsContainer = document.getElementById("productsContainer");
const chatForm = document.getElementById("chatForm");
const chatWindow = document.getElementById("chatWindow");
const userInput = document.getElementById("userInput");
const selectedProductsList = document.getElementById("selectedProductsList");
const clearSelectionsBtn = document.getElementById("clearSelections");
const generateRoutineBtn = document.getElementById("generateRoutine");
const contextSelectedProducts = document.getElementById(
  "contextSelectedProducts",
);
const contextRoutineSummary = document.getElementById("contextRoutineSummary");

/* Keep selected products in a Map so add/remove is easy by product id */
const selectedProducts = new Map();
let allProducts = [];
const productsById = new Map();
let routineGenerated = false;
let generatedRoutineText = "";
const savedSelectionKey = "loreal-selected-products";
let currentCategory = "";
let currentSearch = "";

/* Store full conversation so follow-up answers stay contextual */
const chatMessages = [
  {
    role: "system",
    content:
      "You are a beauty advisor. You may only answer questions about the generated routine or beauty topics such as skincare, haircare, makeup, fragrance, sun care, grooming, and product usage. If a question is outside these topics, politely refuse and redirect to allowed topics. Keep replies practical and concise.",
  },
];

/* Show initial placeholder until user selects a category */
productsContainer.innerHTML = `
  <div class="placeholder-message">
    Select a category to view products
  </div>
`;

/* Load product data from JSON file */
async function loadProducts() {
  const response = await fetch("products.json");
  const data = await response.json();
  return data.products;
}

/* Cache products once and create a quick lookup by id */
async function getAllProducts() {
  if (allProducts.length > 0) {
    return allProducts;
  }

  allProducts = await loadProducts();
  allProducts.forEach((product) => {
    productsById.set(product.id, product);
  });

  return allProducts;
}

/* Save the selected product ids so the list survives page reloads */
function saveSelectedProducts() {
  const selectedIds = Array.from(selectedProducts.keys());
  localStorage.setItem(savedSelectionKey, JSON.stringify(selectedIds));
}

/* Restore saved selections from localStorage */
function loadSavedSelections() {
  const savedIds = JSON.parse(localStorage.getItem(savedSelectionKey) || "[]");

  savedIds.forEach((productId) => {
    const product = productsById.get(productId);
    if (product) {
      selectedProducts.set(productId, product);
    }
  });
}

/* Create HTML for displaying product cards */
function displayProducts(products) {
  if (products.length === 0) {
    productsContainer.innerHTML = `
      <div class="placeholder-message">
        No products found in this category.
      </div>
    `;
    return;
  }

  productsContainer.innerHTML = products
    .map(
      (product) => `
    <div class="product-card ${selectedProducts.has(product.id) ? "is-selected" : ""}" data-product-id="${product.id}">
      <img src="${product.image}" alt="${product.name}">
      <div class="product-info">
        <h3>${product.name}</h3>
        <p>${product.brand}</p>
        <button
          type="button"
          class="details-toggle"
          data-details-id="${product.id}"
          aria-expanded="false"
          aria-controls="product-description-${product.id}"
        >
          View Details
        </button>
        <p class="product-description" id="product-description-${product.id}" hidden>
          ${product.description}
        </p>
      </div>
    </div>
  `,
    )
    .join("");
}

/* Filter products by the active category and search text */
function getVisibleProducts() {
  const searchTerm = currentSearch.toLowerCase();

  return allProducts.filter((product) => {
    const matchesCategory =
      !currentCategory || product.category === currentCategory;

    if (!matchesCategory) {
      return false;
    }

    if (!searchTerm) {
      return true;
    }

    const searchableText = [
      product.name,
      product.brand,
      product.category,
      product.description,
    ]
      .join(" ")
      .toLowerCase();

    return searchableText.includes(searchTerm);
  });
}

/* Render the product grid based on the current filters */
function renderFilteredProducts() {
  if (allProducts.length === 0) {
    return;
  }

  const visibleProducts = getVisibleProducts();

  if (!currentCategory && !currentSearch) {
    productsContainer.innerHTML = `
      <div class="placeholder-message">
        Select a category or search for a product to begin.
      </div>
    `;
    return;
  }

  displayProducts(visibleProducts);
}

/* Draw selected products list and attach a remove button to each item */
function renderSelectedProducts() {
  const selectedArray = Array.from(selectedProducts.values());

  if (selectedArray.length === 0) {
    selectedProductsList.innerHTML =
      '<p class="selected-empty">No products selected yet.</p>';
    updateChatContextPanel();
    return;
  }

  selectedProductsList.innerHTML = selectedArray
    .map(
      (product) => `
      <button type="button" class="selected-pill" data-remove-id="${product.id}">
        ${product.name}
        <span aria-hidden="true">&times;</span>
      </button>
    `,
    )
    .join("");

  saveSelectedProducts();
  updateChatContextPanel();
}

/* Keep selected product names + routine summary visible above the chat */
function updateChatContextPanel() {
  const selectedNames = Array.from(selectedProducts.values()).map(
    (product) => product.name,
  );

  if (selectedNames.length === 0) {
    contextSelectedProducts.textContent = "Selected products: none yet.";
  } else {
    contextSelectedProducts.textContent = `Selected products: ${selectedNames.join(", ")}.`;
  }

  if (!generatedRoutineText) {
    contextRoutineSummary.textContent =
      "Routine summary: generate a routine to start contextual follow-up chat.";
    return;
  }

  const compactSummary = generatedRoutineText.replace(/\s+/g, " ").trim();
  const shortSummary =
    compactSummary.length > 260
      ? `${compactSummary.slice(0, 260)}...`
      : compactSummary;

  contextRoutineSummary.textContent = `Routine summary: ${shortSummary}`;
}

/* Show simple message blocks in the chat window */
function appendChatMessage(role, text) {
  const messageEl = document.createElement("p");
  messageEl.className = `chat-message chat-message-${role}`;
  messageEl.textContent = text;
  chatWindow.append(messageEl);
  chatWindow.scrollTop = chatWindow.scrollHeight;
}

/* Show assistant citations as clickable links below the message */
function appendCitations(citations) {
  if (!Array.isArray(citations) || citations.length === 0) {
    return;
  }

  const citationsList = document.createElement("ul");
  citationsList.className = "chat-citations";

  citations.forEach((citation) => {
    if (!citation.url) return;

    const citationItem = document.createElement("li");
    const citationLink = document.createElement("a");
    citationLink.href = citation.url;
    citationLink.target = "_blank";
    citationLink.rel = "noreferrer noopener";
    citationLink.textContent = citation.title || citation.url;

    citationItem.append(citationLink);
    citationsList.append(citationItem);
  });

  if (citationsList.children.length > 0) {
    chatWindow.append(citationsList);
    chatWindow.scrollTop = chatWindow.scrollHeight;
  }
}

/* Toggle a product when user clicks the card */
function toggleSelectedProduct(productId) {
  if (selectedProducts.has(productId)) {
    selectedProducts.delete(productId);
  } else {
    const product = productsById.get(productId);
    if (product) {
      selectedProducts.set(productId, product);
    }
  }

  renderSelectedProducts();
}

/* Remove every selected product at once */
function clearAllSelections() {
  selectedProducts.clear();
  saveSelectedProducts();
  renderSelectedProducts();

  document.querySelectorAll(".product-card.is-selected").forEach((card) => {
    card.classList.remove("is-selected");
  });
}

/* Click in product grid = select/unselect */
productsContainer.addEventListener("click", (e) => {
  const detailsToggle = e.target.closest(".details-toggle");
  if (detailsToggle) {
    const detailsId = detailsToggle.dataset.detailsId;
    const descriptionEl = document.getElementById(
      `product-description-${detailsId}`,
    );

    if (!descriptionEl) return;

    const isExpanded = detailsToggle.getAttribute("aria-expanded") === "true";
    detailsToggle.setAttribute("aria-expanded", String(!isExpanded));
    detailsToggle.textContent = isExpanded ? "View Details" : "Hide Details";
    descriptionEl.hidden = isExpanded;
    return;
  }

  const card = e.target.closest(".product-card");
  if (!card) return;

  const productId = Number(card.dataset.productId);
  if (!productId) return;

  toggleSelectedProduct(productId);
  card.classList.toggle("is-selected", selectedProducts.has(productId));
});

/* Click selected list item = remove it */
selectedProductsList.addEventListener("click", (e) => {
  const removeBtn = e.target.closest("[data-remove-id]");
  if (!removeBtn) return;

  const productId = Number(removeBtn.dataset.removeId);
  if (!productId) return;

  selectedProducts.delete(productId);
  renderSelectedProducts();

  const productCard = productsContainer.querySelector(
    `[data-product-id="${productId}"]`,
  );
  if (productCard) {
    productCard.classList.remove("is-selected");
  }
});

/* Filter and display products when category changes */
categoryFilter.addEventListener("change", async (e) => {
  await getAllProducts();
  currentCategory = e.target.value;
  renderFilteredProducts();
});

productSearch.addEventListener("input", async (e) => {
  await getAllProducts();
  currentSearch = e.target.value.trim();
  renderFilteredProducts();
});

clearSelectionsBtn.addEventListener("click", clearAllSelections);

/* Call OpenAI Chat Completions API */
async function getOpenAIResponse(messageText) {
  const requestMessages = [
    ...chatMessages,
    { role: "user", content: messageText },
  ];

  const response = await fetch(OPENAI_API_KEY, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o",
      messages: requestMessages,
    }),
  });

  if (!response.ok) {
    throw new Error("Worker request failed");
  }

  const data = await response.json();
  const assistantReply =
    data.answer || data.choices?.[0]?.message?.content || "";
  const citations = Array.isArray(data.citations) ? data.citations : [];

  chatMessages.push({ role: "user", content: messageText });
  chatMessages.push({ role: "assistant", content: assistantReply });

  return {
    answer: assistantReply,
    citations,
  };
}

/* Build first routine from selected products */
generateRoutineBtn.addEventListener("click", async () => {
  if (!OPENAI_API_KEY || !OPENAI_API_KEY.startsWith("http")) {
    chatWindow.textContent =
      "Add your Cloudflare Worker URL in secrets.js first.";
    return;
  }

  const pickedProducts = Array.from(selectedProducts.values());

  if (pickedProducts.length === 0) {
    chatWindow.textContent =
      "Select at least one product first, then click Generate Routine.";
    return;
  }

  const productsSummary = pickedProducts
    .map(
      (product) =>
        `- ${product.name} (${product.brand}) | Category: ${product.category} | ${product.description}`,
    )
    .join("\n");

  const prompt = `Create a simple morning and evening routine using only these selected products when possible. Format the routine as a clear numbered list with each step on its own line. Add separate Morning and Evening sections if helpful. Keep each step concise and practical, and include order, frequency, and quick tips.\n\nSelected products:\n${productsSummary}`;

  appendChatMessage("system", "Generating your routine...");

  try {
    const routineResult = await getOpenAIResponse(prompt);
    const routineReply = routineResult.answer;
    routineGenerated = true;
    generatedRoutineText = routineReply;
    updateChatContextPanel();

    chatWindow.innerHTML = "";
    appendChatMessage("assistant", routineReply);
    appendCitations(routineResult.citations);
  } catch (error) {
    chatWindow.textContent =
      "Something went wrong while generating your routine. Check your Worker deployment and try again.";
  }
});

/* Chat form submission handler */
chatForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const message = userInput.value.trim();
  if (!message) return;

  if (!OPENAI_API_KEY || !OPENAI_API_KEY.startsWith("http")) {
    chatWindow.innerHTML =
      "Add your Cloudflare Worker URL in secrets.js first.";
    return;
  }

  if (!routineGenerated) {
    chatWindow.textContent =
      "Generate a routine first. After that, you can ask follow-up questions about it.";
    return;
  }

  appendChatMessage("user", message);
  appendChatMessage("system", "Thinking...");

  try {
    const replyResult = await getOpenAIResponse(message);

    const loadingMessage = chatWindow.querySelector(
      ".chat-message-system:last-child",
    );
    if (loadingMessage && loadingMessage.textContent === "Thinking...") {
      loadingMessage.remove();
    }

    appendChatMessage("assistant", replyResult.answer);
    appendCitations(replyResult.citations);
  } catch (error) {
    const loadingMessage = chatWindow.querySelector(
      ".chat-message-system:last-child",
    );
    if (loadingMessage && loadingMessage.textContent === "Thinking...") {
      loadingMessage.remove();
    }

    appendChatMessage(
      "system",
      "Something went wrong. Check your Worker deployment and try again.",
    );
  }

  chatForm.reset();
});

/* Load saved selections after the product cache is ready */
(async function initializeSavedSelections() {
  await getAllProducts();
  loadSavedSelections();
  renderSelectedProducts();
  updateChatContextPanel();
  renderFilteredProducts();
})();
