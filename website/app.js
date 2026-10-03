// website/app.js
// AI Agent Documentation - Interactive Website Script
// Author: Samsudin

(function () {
    "use strict";

    /* =====================================================================
       1. TERMINAL TYPING ANIMATION — 5-PHASE AGENT LOOP
       Phases: Perceive → Reason → Act → Observe → Verify
       ===================================================================== */

    const TerminalAnimator = (() => {
        const TYPE_SPEED = 18;          // ms per character
        const LINE_PAUSE = 320;         // pause between lines
        const PHASE_PAUSE = 700;        // pause between phase blocks
        const CURSOR_BLINK = 530;       // cursor blink interval
        let terminalEl = null;
        let cursorEl = null;
        let animationId = null;
        let isPaused = false;
        let cancelCurrent = false;

        // ── 5-phase agent loop script ──────────────────────────────────
        const AGENT_LOOP_SCRIPT = [
            {
                phase: "PERCEIVE",
                color: "#4ec9b0",
                lines: [
                    { delay: 100, text: "$ agent --mode=autonomous --task=\"Analyze Q3 revenue data\"" },
                    { delay: 400, text: "  📡 [PERCEIVE] Scanning input channels...", color: "#4ec9b0" },
                    { delay: 600, text: "  📡 [PERCEIVE] Received dataset: 14,582 rows × 9 columns" },
                    { delay: 500, text: "  📡 [PERCEIVE] Detected schema: {revenue, region, quarter, ...}" },
                    { delay: 550, text: "  📡 [PERCEIVE] Context window loaded: 32K tokens available" },
                ],
            },
            {
                phase: "REASON",
                color: "#c586c0",
                lines: [
                    { delay: 700, text: "  🧠 [REASON] Constructing reasoning chain..." },
                    { delay: 500, text: "  🧠 [REASON] Step 1: Validate data integrity ── 0 anomalies ✓" },
                    { delay: 600, text: "  🧠 [REASON] Step 2: Apply seasonal decomposition algorithm" },
                    { delay: 550, text: "  🧠 [REASON] Step 3: Identify growth regions via clustering" },
                    { delay: 500, text: "  🧠 [REASON] Step 4: Weigh confidence scores (avg: 0.94)" },
                    { delay: 650, text: "  🧠 [REASON] Decision: Report +8.3% YoY with 94% confidence" },
                ],
            },
            {
                phase: "ACT",
                color: "#dcdcaa",
                lines: [
                    { delay: 700, text: "  ⚡ [ACT] Executing planned action sequence..." },
                    { delay: 500, text: "  ⚡ [ACT] → generate_report(format=\"executive\", regions=5)" },
                    { delay: 550, text: "  ⚡ [ACT] → create_visualization(type=\"time_series\")" },
                    { delay: 600, text: "  ⚡ [ACT] → notify_team(channel=\"#analytics\", priority=med)" },
                    { delay: 500, text: "  ⚡ [ACT] All 3 actions dispatched successfully ✓" },
                ],
            },
            {
                phase: "OBSERVE",
                color: "#9cdcfe",
                lines: [
                    { delay: 700, text: "  👁️  [OBSERVE] Monitoring action outcomes..." },
                    { delay: 550, text: "  👁️  [OBSERVE] Report generated: 4 pages, 2 charts" },
                    { delay: 500, text: "  👁️  [OBSERVE] Chart rendered with 87ms latency" },
                    { delay: 600, text: "  👁️  [OBSERVE] Slack message delivered to #analytics (3 recipients)" },
                    { delay: 500, text: "  👁️  [OBSERVE] Feedback signal: positive (latency < 200ms threshold)" },
                ],
            },
            {
                phase: "VERIFY",
                color: "#ce9178",
                lines: [
                    { delay: 700, text: "  ✅ [VERIFY] Running verification suite..." },
                    { delay: 500, text: "  ✅ [VERIFY] data_accuracy: 99.7%  ── PASS ✓" },
                    { delay: 550, text: "  ✅ [VERIFY] action_completion: 3/3   ── PASS ✓" },
                    { delay: 500, text: "  ✅ [VERIFY] policy_compliance: true  ── PASS ✓" },
                    { delay: 600, text: "  ✅ [VERIFY] hallucination_check: 0 issues ── PASS ✓" },
                    { delay: 400, text: "" },
                    { delay: 300, text: "  ┌─────────────────────────────────────────────┐" },
                    { delay: 300, text: "  │  LOOP COMPLETE — Confidence: 94.2%          │" },
                    { delay: 300, text: "  │  Next cycle begins in: 5s (auto-retry)      │" },
                    { delay: 300, text: "  └─────────────────────────────────────────────┘" },
                    { delay: 400, text: "" },
                    { delay: 200, text: "  🔄 Initiating next agent loop iteration..." },
                ],
            },
        ];

        // ── Helpers ────────────────────────────────────────────────────

        function createCursor() {
            const span = document.createElement("span");
            span.className = "terminal-cursor";
            span.textContent = "▌";
            span.style.cssText =
                "color:#4ec9b0;animation:cursor-blink 1s step-end infinite;display:inline-block;width:8px;";
            return span;
        }

        function clearTerminal() {
            if (!terminalEl) return;
            // Keep the initial header lines, remove animated output
            const existing = terminalEl.querySelectorAll(".terminal-output");
            existing.forEach((el) => el.remove());
            if (cursorEl && cursorEl.parentNode) cursorEl.remove();
        }

        function appendOutputBlock() {
            const div = document.createElement("div");
            div.className = "terminal-output";
            div.style.cssText = "white-space:pre-wrap;word-break:break-all;line-height:1.65;";
            terminalEl.appendChild(div);
            return div;
        }

        function sleep(ms) {
            return new Promise((resolve) => {
                const start = Date.now();
                const interval = setInterval(() => {
                    if (cancelCurrent) {
                        clearInterval(interval);
                        resolve();
                        return;
                    }
                    if (Date.now() - start >= ms && !isPaused) {
                        clearInterval(interval);
                        resolve();
                    }
                }, 30);
            });
        }

        async function typeLine(container, line) {
            const lineSpan = document.createElement("span");
            lineSpan.style.display = "block";
            container.appendChild(lineSpan);

            if (line.color) lineSpan.style.color = line.color;
            if (line.delay) await sleep(line.delay);

            cursorEl = createCursor();
            lineSpan.appendChild(cursorEl);

            const text = line.text;
            for (let i = 0; i < text.length; i++) {
                if (cancelCurrent) return;
                while (isPaused && !cancelCurrent) {
                    await new Promise((r) => setTimeout(r, 80));
                }
                if (cancelCurrent) return;

                const char = document.createTextNode(text[i]);
                lineSpan.insertBefore(char, cursorEl);
                await sleep(TYPE_SPEED + Math.random() * 14); // slight randomness
            }

            // Remove cursor from end of completed line, re-attach to next position
            if (cursorEl && cursorEl.parentNode === lineSpan) {
                cursorEl.remove();
            }
        }

        async function runPhase(phaseBlock) {
            const container = appendOutputBlock();

            // Phase header
            const header = document.createElement("span");
            header.style.cssText =
                `display:block;color:${phaseBlock.color};font-weight:700;` +
                `border-left:3px solid ${phaseBlock.color};padding-left:8px;` +
                `margin-top:14px;margin-bottom:6px;letter-spacing:1.5px;`;
            header.textContent = `━━━ PHASE: ${phaseBlock.phase} ━━━`;
            container.appendChild(header);

            for (const line of phaseBlock.lines) {
                if (cancelCurrent) return;
                await typeLine(container, line);
                await sleep(LINE_PAUSE);
            }
            await sleep(PHASE_PAUSE - LINE_PAUSE);
        }

        async function runAnimationLoop() {
            while (!cancelCurrent) {
                clearTerminal();
                for (const phaseBlock of AGENT_LOOP_SCRIPT) {
                    if (cancelCurrent) return;
                    await runPhase(phaseBlock);
                }
                await sleep(1800); // pause before next full loop
            }
        }

        // ── Public API ─────────────────────────────────────────────────

        function init(terminalSelector, outputSelector) {
            terminalEl = document.querySelector(terminalSelector);
            if (!terminalEl) return;
            terminalEl.scrollTop = terminalEl.scrollHeight;

            const playBtn = document.querySelector("[data-terminal-action='play']");
            const pauseBtn = document.querySelector("[data-terminal-action='pause']");
            const restartBtn = document.querySelector("[data-terminal-action='restart']");

            if (playBtn) {
                playBtn.addEventListener("click", () => {
                    isPaused = false;
                    if (!animationId) {
                        animationId = runAnimationLoop();
                    }
                });
            }

            if (pauseBtn) {
                pauseBtn.addEventListener("click", () => {
                    isPaused = true;
                });
            }

            if (restartBtn) {
                restartBtn.addEventListener("click", () => {
                    cancelCurrent = true;
                    setTimeout(() => {
                        cancelCurrent = false;
                        isPaused = false;
                        if (animationId) animationId = null;
                        clearTerminal();
                        animationId = runAnimationLoop();
                    }, 100);
                });
            }

            // Auto-start after slight delay
            setTimeout(() => {
                if (!animationId) animationId = runAnimationLoop();
            }, 600);
        }

        function stop() {
            cancelCurrent = true;
        }

        return { init, stop };
    })();

    /* =====================================================================
       2. COPY-TO-CLIPBOARD HANDLER FOR ALL CODE SNIPPETS
       Includes tooltip feedback on every copy button.
       ===================================================================== */

    const ClipboardManager = (() => {
        const TOOLTIP_DURATION = 2200;

        function createTooltip() {
            const tip = document.createElement("div");
            tip.className = "copy-tooltip";
            tip.style.cssText = [
                "position:fixed",
                "z-index:9999",
                "background:#0d1117",
                "color:#4ec9b0",
                "border:1px solid #4ec9b0",
                "padding:6px 14px",
                "border-radius:6px",
                "font-size:13px",
                "font-family:monospace",
                "pointer-events:none",
                "opacity:0",
                "transition:opacity 0.25s ease, transform 0.25s ease",
                "transform:translateY(6px)",
                "box-shadow:0 4px 14px rgba(0,0,0,0.35)",
            ].join(";");
            tip.textContent = "✓ Copied to clipboard!";
            document.body.appendChild(tip);
            return tip;
        }

        function showErrorTooltip(x, y) {
            const tip = createTooltip();
            tip.style.borderColor = "#f47067";
            tip.style.color = "#f47067";
            tip.textContent = "✗ Copy failed";
            tip.style.left = `${x}px`;
            tip.style.top = `${y - 44}px`;
            tip.style.opacity = "1";
            tip.style.transform = "translateY(0)";
            setTimeout(() => {
                tip.style.opacity = "0";
                tip.style.transform = "translateY(6px)";
                setTimeout(() => tip.remove(), 300);
            }, TOOLTIP_DURATION);
        }

        async function copyText(text) {
            // Try modern clipboard API first
            if (navigator.clipboard && window.isSecureContext) {
                try {
                    await navigator.clipboard.writeText(text);
                    return true;
                } catch (_) {
                    // fall through to fallback
                }
            }
            // Fallback using textarea
            try {
                const ta = document.createElement("textarea");
                ta.value = text;
                ta.style.cssText = "position:fixed;left:-9999px;top:0;opacity:0;";
                document.body.appendChild(ta);
                ta.focus();
                ta.select();
                const ok = document.execCommand("copy");
                ta.remove();
                return ok;
            } catch (_) {
                return false;
            }
        }

        function showTooltip(button) {
            const rect = button.getBoundingClientRect();
            const tip = createTooltip();
            tip.style.left = `${rect.left + rect.width / 2 - 70}px`;
            tip.style.top = `${rect.top - 42}px`;

            requestAnimationFrame(() => {
                tip.style.opacity = "1";
                tip.style.transform = "translateY(0)";
            });

            // Pulse effect on button
            button.style.borderColor = "#4ec9b0";
            button.style.color = "#4ec9b0";

            setTimeout(() => {
                tip.style.opacity = "0";
                tip.style.transform = "translateY(6px)";
                setTimeout(() => tip.remove(), 300);
                button.style.borderColor = "";
                button.style.color = "";
            }, TOOLTIP_DURATION);
        }

        function extractCodeFromBlock(codeBlock) {
            // Prefer <pre><code> content
            const codeEl = codeBlock.querySelector("pre code, code, .code-content");
            if (codeEl) return codeEl.innerText.trim();

            // Or look for a hidden textarea
            const textarea = codeBlock.querySelector("textarea.code-raw");
            if (textarea) return textarea.value.trim();

            // Or grab the pre block directly
            const pre = codeBlock.querySelector("pre");
            if (pre) return pre.innerText.trim();

            return codeBlock.innerText.trim();
        }

        function init() {
            // ── Auto-detect all code blocks and attach copy buttons ──
            const codeBlocks = document.querySelectorAll(
                ".code-block, .snippet, [data-code-block], .highlight, .source-code, pre"
            );

            codeBlocks.forEach((block) => {
                // Skip if block already has a copy button
                if (block.querySelector(".copy-btn")) return;

                // Wrap bare <pre> elements that aren't inside a .code-block
                let target = block;
                if (block.tagName === "PRE" && !block.closest(".code-block")) {
                    const wrapper = document.createElement("div");
                    wrapper.className = "code-block auto-wrapped";
                    block.parentNode.insertBefore(wrapper, block);
                    wrapper.appendChild(block);
                    target = wrapper;
                }

                // Create copy button
                const btn = document.createElement("button");
                btn.className = "copy-btn";
                btn.setAttribute("data-tooltip", "Copy code");
                btn.setAttribute("aria-label", "Copy code to clipboard");
                btn.style.cssText = [
                    "position:absolute",
                    "top:8px",
                    "right:8px",
                    "background:rgba(13,17,23,0.8)",
                    "border:1px solid #30363d",
                    "color:#8b949e",
                    "padding:4px 10px",
                    "border-radius:6px",
                    "cursor:pointer",
                    "font-size:12px",
                    "font-family:monospace",
                    "transition:all 0.2s ease",
                    "z-index:10",
                    "display:flex",
                    "align-items:center",
                    "gap:4px",
                    "line-height:1",
                ].join(";");
                btn.innerHTML = "📋 Copy";

                // Ensure parent has position:relative
                const computed = window.getComputedStyle(target);
                if (computed.position === "static") {
                    target.style.position = "relative";
                }

                target.appendChild(btn);

                // Hover effect
                btn.addEventListener("mouseenter", () => {
                    btn.style.borderColor = "#4ec9b0";
                    btn.style.color = "#4ec9b0";
                    btn.style.background = "rgba(78,201,176,0.08)";
                });
                btn.addEventListener("mouseleave", () => {
                    if (btn.dataset.copied !== "true") {
                        btn.style.borderColor = "#30363d";
                        btn.style.color = "#8b949e";
                        btn.style.background = "rgba(13,17,23,0.8)";
                    }
                });

                // Click handler
                btn.addEventListener("click", async () => {
                    const code = extractCodeFromBlock(target);
                    const rect = btn.getBoundingClientRect();
                    const success = await copyText(code);

                    if (success) {
                        showTooltip(btn);
                        btn.innerHTML = "✓ Copied";
                        btn.dataset.copied = "true";
                        btn.style.borderColor = "#4ec9b0";
                        btn.style.color = "#4ec9b0";

                        setTimeout(() => {
                            btn.innerHTML = "📋 Copy";
                            delete btn.dataset.copied;
                            btn.style.borderColor = "#30363d";
                            btn.style.color = "#8b949e";
                        }, TOOLTIP_DURATION);
                    } else {
                        showErrorTooltip(rect.left + rect.width / 2, rect.top);
                    }
                });
            });

            // ── Also handle any explicit copy buttons already in HTML ──
            document.querySelectorAll("[data-copy]").forEach((btn) => {
                btn.addEventListener("click", async () => {
                    const targetId = btn.getAttribute("data-copy");
                    const targetEl = document.getElementById(targetId) || btn.closest(".code-block");
                    if (!targetEl) return;

                    const code = extractCodeFromBlock(targetEl);
                    const rect = btn.getBoundingClientRect();
                    const success = await copyText(code);

                    if (success) {
                        showTooltip(btn);
                        const original = btn.textContent;
                        btn.textContent = "✓ Copied!";
                        setTimeout(() => { btn.textContent = original; }, TOOLTIP_DURATION);
                    } else {
                        showErrorTooltip(rect.left + rect.width / 2, rect.top);
                    }
                });
            });
        }

        return { init };
    })();

    /* =====================================================================
       3. INTERACTIVE FILTER TABS FOR 10 AI MODELS
       ===================================================================== */

    const ModelFilter = (() => {
        // ── 10 AI Models data ──────────────────────────────────────────
        const MODELS = [
            {
                id: "gpt-4o",
                name: "GPT-4o",
                provider: "OpenAI",
                tags: ["multimodal", "reasoning", "general"],
                badge: "🟠",
                description: "Omni-modal model with real-time vision & audio reasoning.",
                strengths: ["Multimodal", "Speed", "Coding"],
                contextWindow: "128K",
                params: "Unknown",
            },
            {
                id: "claude-3.5-sonnet",
                name: "Claude 3.5 Sonnet",
                provider: "Anthropic",
                tags: ["reasoning", "coding", "general"],
                badge: "🟣",
                description: "Balanced performance across reasoning, coding, and safety.",
                strengths: ["Reasoning", "Safety", "Writing"],
                contextWindow: "200K",
                params: "Unknown",
            },
            {
                id: "gemini-1.5-pro",
                name: "Gemini 1.5 Pro",
                provider: "Google",
                tags: ["multimodal", "reasoning", "general"],
                badge: "🔵",
                description: "Large context window with strong multimodal understanding.",
                strengths: ["Context", "Multimodal", "Research"],
                contextWindow: "1M",
                params: "Unknown",
            },
            {
                id: "llama-3.1-405b",
                name: "Llama 3.1 405B",
                provider: "Meta",
                tags: ["open-source", "reasoning", "general"],
                badge: "🟢",
                description: "Largest open-weight model with competitive reasoning.",
                strengths: ["Open Source", "Reasoning", "Fine-tuning"],
                contextWindow: "128K",
                params: "405B",
            },
            {
                id: "mistral-large-2",
                name: "Mistral Large 2",
                provider: "Mistral",
                tags: ["open-source", "coding", "general"],
                badge: "🟡",
                description: "Efficient open model excelling at code and reasoning.",
                strengths: ["Efficiency", "Coding", "Multilingual"],
                contextWindow: "128K",
                params: "123B",
            },
            {
                id: "qwen-2.5-72b",
                name: "Qwen 2.5 72B",
                provider: "Alibaba",
                tags: ["open-source", "multilingual", "general"],
                badge: "🔴",
                description: "Strong multilingual capabilities with open weights.",
                strengths: ["Multilingual", "Open Source", "Math"],
                contextWindow: "128K",
                params: "72B",
            },
            {
                id: "deepseek-v3",
                name: "DeepSeek V3",
                provider: "DeepSeek",
                tags: ["open-source", "coding", "reasoning"],
                badge: "🔷",
                description: "MoE architecture with exceptional coding performance.",
                strengths: ["Coding", "MoE", "Math"],
                contextWindow: "128K",
                params: "671B (37B active)",
            },
            {
                id: "gemma-2-27b",
                name: "Gemma 2 27B",
                provider: "Google",
                tags: ["open-source", "general", "reasoning"],
                badge: "⚪",
                description: "Compact open model with efficient knowledge retrieval.",
                strengths: ["Efficiency", "RAG", "Open Source"],
                contextWindow: "8K",
                params: "27B",
            },
            {
                id: "phi-3-medium",
                name: "Phi-3 Medium",
                provider: "Microsoft",
                tags: ["open-source", "coding", "reasoning"],
                badge: "🟤",
                description: "Small but mighty model trained on synthetic data.",
                strengths: ["Small Model", "Coding", "Reasoning"],
                contextWindow: "128K",
                params: "14B",
            },
            {
                id: "command-r-plus",
                name: "Command R+",
                provider: "Cohere",
                tags: ["general", "rag", "enterprise"],
                badge: "🌸",
                description: "Enterprise-focused model optimized for RAG workflows.",
                strengths: ["RAG", "Enterprise", "Tool Use"],
                contextWindow: "128K",
                params: "104B",
            },
        ];

        // ── Filter categories ──────────────────────────────────────────
        const FILTERS = [
            { id: "all",        label: "All Models",  icon: "🌐" },
            { id: "open-source",label: "Open Source", icon: "🔓" },
            { id: "general",    label: "General",     icon: "🧠" },
            { id: "coding",     label: "Coding",      icon: "💻" },
            { id: "reasoning",  label: "Reasoning",   icon: "🔮" },
            { id: "multimodal", label: "Multimodal",  icon: "👁️" },
            { id: "multilingual",label: "Multilingual",icon: "🌍" },
            { id: "rag",        label: "RAG",         icon: "📚" },
            { id: "enterprise", label: "Enterprise",  icon: "🏢" },
        ];

        let activeFilter = "all";
        let cardsContainer = null;
        let tabsContainer = null;
        let noResultsEl = null;

        // ── Render card ────────────────────────────────────────────────

        function createCard(model, index) {
            const card = document.createElement("div");
            card.className = "model-card";
            card.setAttribute("data-model-id", model.id);
            card.setAttribute("data-tags", model.tags.join(","));
            card.style.cssText = [
                "background:#161b22",
                "border:1px solid #30363d",
                "border-radius:12px",
                "padding:22px 20px",
                "transition:all 0.3s cubic-bezier(0.4,0,0.2,1)",
                "cursor:pointer",
                "opacity:0",
                "transform:translateY(16px)",
            ].join(";");

            // Staggered animation delay
            setTimeout(() => {
                card.style.opacity = "1";
                card.style.transform = "translateY(0)";
            }, index * 70);

            const badge = model.badge;
            const strengthTags = model.strengths
                .map(
                    (s) =>
                        `<span style="background:rgba(78,201,176,0.1);color:#4ec9b0;` +
                        `border:1px solid rgba(78,201,176,0.3);padding:3px 10px;` +
                        `border-radius:20px;font-size:11px;display:inline-block;` +
                        `margin:3px 4px 0 0;">${s}</span>`
                )
                .join("");

            const tagBadges = model.tags
                .map(
                    (t) =>
                        `<span style="background:rgba(97,175,254,0.08);color:#58a6ff;` +
                        `padding:2px 8px;border-radius:4px;font-size:11px;` +
                        `margin-right:6px;text-transform:uppercase;letter-spacing:0.5px;">${t}</span>`
                )
                .join("");

            card.innerHTML = `
                <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:12px;">
                    <div style="display:flex;align-items:center;gap:10px;">
                        <span style="font-size:28px;line-height:1;">${badge}</span>
                        <div>
                            <div style="color:#e6edf3;font-weight:700;font-size:17px;">${model.name}</div>
                            <div style="color:#8b949e;font-size:13px;margin-top:2px;">${model.provider}</div>
                        </div>
                    </div>
                    <div style="text-align:right;">
                        <div style="color:#d2a8ff;font-size:12px;font-weight:600;">${model.contextWindow}</div>
                        <div style="color:#6e7681;font-size:11px;">context</div>
                    </div>
                </div>
                <p style="color:#8b949e;font-size:13.5px;line-height:1.55;margin-bottom:14px;">
                    ${model.description}
                </p>
                <div style="margin-bottom:10px;">
                    <div style="color:#6e7681;font-size:11px;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">Strengths</div>
                    <div>${strengthTags}</div>
                </div>
                <div style="margin-bottom:10px;">
                    <div style="color:#6e7681;font-size:11px;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">Tags</div>
                    <div>${tagBadges}</div>
                </div>
                <div style="border-top:1px solid #21262d;padding-top:12px;display:flex;justify-content:space-between;font-size:12px;">
                    <span style="color:#8b949e;">Params: <strong style="color:#e6edf3;">${model.params}</strong></span>
                    <span style="color:#4ec9b0;">${model.id}</span>
                </div>
            `;

            // Hover effects
            card.addEventListener("mouseenter", () => {
                card.style.borderColor = "#4ec9b0";
                card.style.boxShadow = "0 8px 30px rgba(78,201,176,0.12)";
                card.style.transform = "translateY(-4px)";
            });
            card.addEventListener("mouseleave", () => {
                card.style.borderColor = "#30363d";
                card.style.boxShadow = "none";
                card.style.transform = "translateY(0)";
            });

            return card;
        }

        // ── Filter logic ───────────────────────────────────────────────

        function applyFilter(filterId) {
            activeFilter = filterId;
            if (!cardsContainer) return;

            const cards = cardsContainer.querySelectorAll(".model-card");
            let visibleCount = 0;

            cards.forEach((card, idx) => {
                const tags = (card.getAttribute("data-tags") || "").split(",");
                const shouldShow = filterId === "all" || tags.includes(filterId);

                if (shouldShow) {
                    card.style.display = "block";
                    visibleCount++;
                    // Re-animate
                    card.style.opacity = "0";
                    card.style.transform = "translateY(16px)";
                    setTimeout(() => {
                        card.style.opacity = "1";
                        card.style.transform = "translateY(0)";
                    }, visibleCount * 60);
                } else {
                    card.style.opacity = "0";
                    card.style.transform = "translateY(8px)";
                    setTimeout(() => {
                        card.style.display = "none";
                    }, 250);
                }
            });

            // Show/hide no-results message
            if (noResultsEl) {
                setTimeout(() => {
                    noResultsEl.style.display = visibleCount === 0 ? "block" : "none";
                }, 300);
            }

            // Update tab active states
            if (tabsContainer) {
                tabsContainer.querySelectorAll(".filter-tab").forEach((tab) => {
                    const isActive = tab.getAttribute("data-filter") === filterId;
                    tab.classList.toggle("active", isActive);
                    tab.style.background = isActive ? "#4ec9b0" : "transparent";
                    tab.style.color = isActive ? "#0d1117" : "#8b949e";
                    tab.style.borderColor = isActive ? "#4ec9b0" : "#30363d";
                    tab.style.fontWeight = isActive ? "700" : "400";
                });
            }

            // Update count badge
            const countEl = document.querySelector("[data-filter-count]");
            if (countEl) countEl.textContent = `${visibleCount} model${visibleCount !== 1 ? "s" : ""}`;
        }

        // ── Render tabs ────────────────────────────────────────────────

        function createTabs() {
            if (!tabsContainer) return;

            FILTERS.forEach((filter) => {
                const tab = document.createElement("button");
                tab.className = "filter-tab" + (filter.id === "all" ? " active" : "");
                tab.setAttribute("data-filter", filter.id);
                tab.setAttribute("aria-pressed", filter.id === "all" ? "true" : "false");
                tab.style.cssText = [
                    "display:inline-flex",
                    "align-items:center",
                    "gap:6px",
                    "padding:8px 18px",
                    "border-radius:24px",
                    "border:1.5px solid " + (filter.id === "all" ? "#4ec9b0" : "#30363d"),
                    "background:" + (filter.id === "all" ? "#4ec9b0" : "transparent"),
                    "color:" + (filter.id === "all" ? "#0d1117" : "#8b949e"),
                    "cursor:pointer",
                    "font-size:13.5px",
                    "font-weight:" + (filter.id === "all" ? "700" : "400"),
                    "transition:all 0.25s cubic-bezier(0.4,0,0.2,1)",
                    "font-family:inherit",
                    "white-space:nowrap",
                    "outline:none",
                ].join(";");
                tab.innerHTML = `<span style="font-size:15px;">${filter.icon}</span> ${filter.label}`;

                // Hover
                tab.addEventListener("mouseenter", () => {
                    if (!tab.classList.contains("active")) {
                        tab.style.borderColor = "#4ec9b0";
                        tab.style.color = "#4ec9b0";
                        tab.style.background = "rgba(78,201,176,0.06)";
                    }
                });
                tab.addEventListener("mouseleave", () => {
                    if (!tab.classList.contains("active")) {
                        tab.style.borderColor = "#30363d";
                        tab.style.color = "#8b949e";
                        tab.style.background = "transparent";
                    }
                });

                tab.addEventListener("click", () => {
                    applyFilter(filter.id);
                    // Haptic-style ripple
                    tab.style.transform = "scale(0.95)";
                    setTimeout(() => { tab.style.transform = "scale(1)"; }, 120);
                });

                tabsContainer.appendChild(tab);
            });
        }

        // ── Render cards ───────────────────────────────────────────────

        function renderCards() {
            if (!cardsContainer) return;
            cardsContainer.innerHTML = "";

            MODELS.forEach((model, i) => {
                cardsContainer.appendChild(createCard(model, i));
            });
        }

        // ── Init ───────────────────────────────────────────────────────

        function init(tabsSelector, cardsSelector) {
            tabsContainer = document.querySelector(tabsSelector);
            cardsContainer = document.querySelector(cardsSelector);
            noResultsEl = document.querySelector("[data-no-results]");

            if (!tabsContainer || !cardsContainer) return;

            createTabs();
            renderCards();

            // Keyboard navigation for tabs
            tabsContainer.addEventListener("keydown", (e) => {
                const tabs = Array.from(tabsContainer.querySelectorAll(".filter-tab"));
                const current = tabs.findIndex((t) => t.classList.contains("active"));
                if (e.key === "ArrowRight" || e.key === "ArrowDown") {
                    e.preventDefault();
                    const next = tabs[(current + 1) % tabs.length];
                    next.focus();
                    applyFilter(next.getAttribute("data-filter"));
                } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
                    e.preventDefault();
                    const prev = tabs[(current - 1 + tabs.length) % tabs.length];
                    prev.focus();
                    applyFilter(prev.getAttribute("data-filter"));
                }
            });
        }

        return { init, applyFilter };
    })();

    /* =====================================================================
       4. SMOOTH SCROLL + NAVIGATION HIGHLIGHTING
       ===================================================================== */

    const SmoothNav = (() => {
        function init() {
            // Smooth scroll for all anchor links
            document.querySelectorAll('a[href^="#"]').forEach((link) => {
                link.addEventListener("click", (e) => {
                    const target = document.querySelector(link.getAttribute("href"));
                    if (target) {
                        e.preventDefault();
                        target.scrollIntoView({ behavior: "smooth", block: "start" });
                        // Update URL without jump
                        history.replaceState(null, "", link.getAttribute("href"));
                    }
                });
            });

            // Highlight nav links on scroll
            const sections = document.querySelectorAll("section[id]");
            const navLinks = document.querySelectorAll(".nav-link, nav a[href^='#']");

            if (sections.length && navLinks.length) {
                const observer = new IntersectionObserver(
                    (entries) => {
                        entries.forEach((entry) => {
                            if (entry.isIntersecting) {
                                navLinks.forEach((l) => {
                                    l.classList.remove("nav-active");
                                    l.style.color = "";
                                    l.style.borderBottomColor = "transparent";
                                });
                                const active = document.querySelector(
                                    `nav a[href="#${entry.target.id}"]`
                                );
                                if (active) {
                                    active.classList.add("nav-active");
                                    active.style.color = "#4ec9b0";
                                    active.style.borderBottomColor = "#4ec9b0";
                                }
                            }
                        });
                    },
                    { threshold: 0.3, rootMargin: "-60px 0px 0px 0px" }
                );
                sections.forEach((s) => observer.observe(s));
            }
        }

        return { init };
    })();

    /* =====================================================================
       5. SCROLL-REVEAL ANIMATIONS
       ===================================================================== */

    const ScrollReveal = (() => {
        function init() {
            const targets = document.querySelectorAll(".reveal-on-scroll");
            if (!targets.length) return;

            // Apply initial hidden state
            targets.forEach((el) => {
                el.style.opacity = "0";
                el.style.transform = "translateY(30px)";
                el.style.transition = "opacity 0.7s ease, transform 0.7s ease";
            });

            const observer = new IntersectionObserver(
                (entries) => {
                    entries.forEach((entry) => {
                        if (entry.isIntersecting) {
                            entry.target.style.opacity = "1";
                            entry.target.style.transform = "translateY(0)";
                            observer.unobserve(entry.target);
                        }
                    });
                },
                { threshold: 0.12 }
            );

            targets.forEach((el) => observer.observe(el));
        }

        return { init };
    })();

    /* =====================================================================
       6. BOOT SEQUENCE
       ===================================================================== */

    function boot() {
        // Terminal typing animation
        TerminalAnimator.init("#agent-terminal");

        // Copy-to-clipboard for all code snippets
        ClipboardManager.init();

        // Filter tabs for 10 AI models
        ModelFilter.init("#model-filter-tabs", "#model-cards");

        // Smooth scroll & nav
        SmoothNav.init();

        // Scroll-reveal
        ScrollReveal.init();

        console.log(
            "%c🤖 Agent Loop Documentation — app.js loaded",
            "color:#4ec9b0;font-size:14px;font-weight:bold;font-family:monospace;"
        );
    }

    // Wait for DOM
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", boot);
    } else {
        boot();
    }
})();