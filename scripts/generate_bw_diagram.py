import os
from PIL import Image, ImageDraw, ImageFont

def create_bw_architecture_diagram():
    # 2600 x 1700 high resolution canvas
    width, height = 2600, 1700
    img = Image.new("RGB", (width, height), "white")
    draw = ImageDraw.Draw(img)

    def get_font(size, bold=False):
        try:
            if bold:
                return ImageFont.truetype("arialbd.ttf", size)
            return ImageFont.truetype("arial.ttf", size)
        except Exception:
            try:
                if bold:
                    return ImageFont.truetype("segoeuib.ttf", size)
                return ImageFont.truetype("segoeui.ttf", size)
            except Exception:
                return ImageFont.load_default()

    font_main_title = get_font(36, bold=True)
    font_sub_title = get_font(18, bold=False)
    font_layer_label = get_font(18, bold=True)
    font_header = get_font(17, bold=True)
    font_item = get_font(14, bold=False)
    font_small = get_font(13, bold=False)
    font_badge = get_font(11, bold=True)

    # Outer border frame
    draw.rectangle([30, 30, width - 30, height - 30], outline="black", width=2)

    # Main Header
    draw.text((width // 2, 60), "ANTRI CODE — HIGH-LEVEL SYSTEM ARCHITECTURE", fill="black", font=font_main_title, anchor="mm")
    draw.text((width // 2, 98), "Autonomous Multi-Surface Coding Meta-Agent & Verification Ecosystem (Google Gemini 3.7 Core)", fill="black", font=font_sub_title, anchor="mm")
    draw.line([80, 120, width - 80, 120], fill="black", width=2)

    def draw_box(x, y, w, h, title, items=[], badge=""):
        draw.rectangle([x, y, x + w, y + h], fill="white", outline="black", width=2)
        # Header separator
        draw.line([x, y + 36, x + w, y + 36], fill="black", width=1)
        # Title text
        draw.text((x + 14, y + 18), title, fill="black", font=font_header, anchor="lm")
        # Badge
        if badge:
            badge_w = 90
            badge_h = 22
            bx2 = x + w - 12
            bx1 = bx2 - badge_w
            by1 = y + 7
            by2 = by1 + badge_h
            draw.rectangle([bx1, by1, bx2, by2], fill="black", outline="black")
            draw.text(((bx1 + bx2) // 2, (by1 + by2) // 2), badge, fill="white", font=font_badge, anchor="mm")
        
        # Items
        curr_y = y + 50
        for item in items:
            clean_item = item.strip()
            if clean_item.startswith("•"):
                draw.text((x + 16, curr_y), f"{clean_item}", fill="black", font=font_item)
            else:
                draw.text((x + 16, curr_y), f"• {clean_item}", fill="black", font=font_item)
            curr_y += 24

    def draw_down_arrow(x, y1, y2):
        draw.line([x, y1, x, y2], fill="black", width=2)
        draw.polygon([(x, y2), (x - 6, y2 - 10), (x + 6, y2 - 10)], fill="black")

    # ==================== LAYER 1: CLIENT SURFACES ====================
    draw.text((80, 145), "LAYER 1: TRI-SURFACE CLIENT INTERFACES", fill="black", font=font_layer_label)
    
    box_w = 780
    box_y = 175
    box_h = 180

    draw_box(80, box_y, box_w, box_h, "NATIVE FLUTTER MOBILE APP", [
        "Interactive Agent Studio & Slide-out Drawer Navigation",
        "Autonomous Thinking Profiles & Silent Nuance Extractor",
        "Dialectic Self-Debate & Goal Loop Touch Views",
        "Fullscreen Interactive Artifact Viewer & Mind Maps",
        "Multimodal Camera & Gallery Context Attachment (+ / @)"
    ], "MOBILE")

    draw_box(910, box_y, box_w, box_h, "DESKTOP CONTROL PLANE (11 TABS)", [
        "Agent Studio · Codebase Radar · Code Workspace · Timeline",
        "Dialectic Arena · Goal Pipeline · Dynamic Skills · Memory",
        "BugTwin Visual Sandbox & CrashZero Time-Travel Replay",
        "Artifacts Hub (Desktop / Tablet / Mobile Viewport Toggles)",
        "Interactive Prompt Toolkit Autocomplete Palette (/)"
    ], "DESKTOP")

    draw_box(1740, box_y, box_w, box_h, "TERMINAL CLI (antri)", [
        "Interactive Continuous REPL with Chunky Purple/ASCII Banner",
        "Prompt Toolkit Floating Autocomplete Menu (/)",
        "Surgical File Edit Tools (edit_file, grep_search, find_files)",
        "Dynamic Skill Synthesizer (Python Execution Engine)",
        "One-shot (-p), Debate (-d), and Goal (-g) Launcher Flags"
    ], "CLI")

    # Connectors from Layer 1 to Layer 2
    draw_down_arrow(470, box_y + box_h, 385)
    draw_down_arrow(1300, box_y + box_h, 385)
    draw_down_arrow(2130, box_y + box_h, 385)
    
    draw.line([470, 385, 2130, 385], fill="black", width=2)
    draw_down_arrow(1300, 385, 415)

    # ==================== LAYER 2: CORE META-AGENT ORCHESTRATOR ====================
    draw.text((80, 420), "LAYER 2: CORE META-AGENT ORCHESTRATOR & INTENT ROUTING", fill="black", font=font_layer_label)
    
    core_y = 445
    core_w = 2440
    core_h = 95
    draw.rectangle([80, core_y, 80 + core_w, core_y + core_h], fill="white", outline="black", width=2)
    draw.line([80, core_y + 32, 80 + core_w, core_y + 32], fill="black", width=1)
    draw.text((80 + core_w // 2, core_y + 16), "ANTRI AGENT ENGINE (AgentOrchestrator · Context Gating · Tool Calling Loop · SSE Streaming)", fill="black", font=font_header, anchor="mm")
    
    draw.text((110, core_y + 44), "• Plan Mode (Architectural Blueprinting)", fill="black", font=font_item)
    draw.text((110, core_y + 68), "• Vibe Mode (Continuous Conversational Code)", fill="black", font=font_item)
    
    draw.text((700, core_y + 44), "• Silent Philosophy & Preference Extractor", fill="black", font=font_item)
    draw.text((700, core_y + 68), "• Tool Scaffolder & Code Patch Applier", fill="black", font=font_item)
    
    draw.text((1330, core_y + 44), "• SSE Stream Router (Token & Stage Emitters)", fill="black", font=font_item)
    draw.text((1330, core_y + 68), "• Subprocess Runner & Python Sandbox Manager", fill="black", font=font_item)

    draw.text((1960, core_y + 44), "• Cloud Run Health Probes (/api/health)", fill="black", font=font_item)
    draw.text((1960, core_y + 68), "• Zero-Config Judge Session Manager", fill="black", font=font_item)

    # Horizontal bus and down connectors from Layer 2 to Layer 3
    bus_y = 570
    draw.line([275, core_y + core_h, 275, bus_y], fill="black", width=2)
    draw.line([2315, core_y + core_h, 2315, bus_y], fill="black", width=2)
    draw.line([275, bus_y, 2315, bus_y], fill="black", width=2)
    
    sub_xs = [275, 680, 1090, 1500, 1910, 2315]
    for x in sub_xs:
        draw_down_arrow(x, bus_y, 630)

    # ==================== LAYER 3: AUTONOMOUS AGENTIC ENGINES ====================
    # Draw label above Layer 3 with white backing to prevent line clash
    draw.rectangle([75, 592, 595, 616], fill="white", outline="white")
    draw.text((80, 595), "LAYER 3: AUTONOMOUS AGENTIC ENGINES & SUBSYSTEMS", fill="black", font=font_layer_label)

    sub_y = 630
    sub_w = 385
    sub_h = 275

    draw_box(80, sub_y, sub_w, sub_h, "DIALECTIC ARENA", [
        "4-Persona Multi-Agent Debate",
        "Proposer (Thesis Scaffolding)",
        "Adversary (Antithesis Attack)",
        "Researcher (Live Web/Docs)",
        "Judge (Consensus Synthesis)",
        "Live SSE Token & Card Streaming",
        "Silent Background Debate Mode"
    ], "DEBATE")

    draw_box(490, sub_y, sub_w, sub_h, "GOAL LOOP ENGINE", [
        "Autonomous 3-Stage Pipeline",
        "Stage 1: Draft Scaffolding",
        "Stage 2: Adversarial Critique",
        "Stage 3: Hardened Synthesis",
        "Multi-Iteration Refinement",
        "Structured Result Payloads",
        "Interactive HTML Artifacts"
    ], "GOAL")

    draw_box(900, sub_y, sub_w, sub_h, "BUGTWIN VERIFIER", [
        "Autonomous Bug Reproduction",
        "Minimal Red Test Synthesis",
        "Deterministic Failure Proof [RED]",
        "Surgical Self-Healing Patch",
        "Verified Green Pass [GREEN]",
        "Interactive Visual Sandbox",
        "Zero Human Intervention"
    ], "BUG-FIX")

    draw_box(1310, sub_y, sub_w, sub_h, "CRASHZERO DEBUGGER", [
        "Time-Travel Incident Replay",
        "Call Stack De-Minification",
        "Millisecond Frame Slicing",
        "Scrubbable Timeline Player",
        "Live Variable State Inspection",
        "Root-Cause Dialectic Analysis",
        "Automated Fix PR Generator"
    ], "REPLAY")

    draw_box(1720, sub_y, sub_w, sub_h, "DYNAMIC SKILLS", [
        "Autonomous Tool Synthesis",
        "Sandboxed Python Execution",
        "On-the-Fly Tool Generation",
        "Automated Dry-Run Verify",
        "Local Skills Registry Storage",
        "Self-Debugging Error Intercept",
        "Meta-Optimization Metrics"
    ], "SKILLS")

    draw_box(2130, sub_y, sub_w, sub_h, "INTERACTIVE ARTIFACTS", [
        "Runnable Web Applications",
        "Workout SPAs (Sets & Timers)",
        "Diet / Macro Calculators",
        "Interactive Study Roadmaps",
        "Mermaid 10 Mind Maps",
        "Pan & Pinch-to-Zoom Gestures",
        "Device Viewport Switching"
    ], "SPA")

    # Connectors from Layer 3 to Layer 4/5
    bus_y2 = sub_y + sub_h + 25
    for x in sub_xs:
        draw.line([x, sub_y + sub_h, x, bus_y2], fill="black", width=2)
    draw.line([275, bus_y2, 2315, bus_y2], fill="black", width=2)
    
    draw_down_arrow(680, bus_y2, 975)
    draw_down_arrow(1900, bus_y2, 975)

    # ==================== LAYER 4 & 5: INFERENCE & MEMORY ====================
    draw.text((80, 945), "LAYER 4: AI MODEL INFERENCE & CLOUD RUN", fill="black", font=font_layer_label)
    draw.text((1310, 945), "LAYER 5: LIFELONG PERSISTENCE & FIRESTORE SYNC", fill="black", font=font_layer_label)

    bot_y = 975
    bot_w = 1190
    bot_h = 440

    draw_box(80, bot_y, bot_w, bot_h, "GOOGLE GEMINI 3.7 SUITE & GOOGLE CLOUD INFRASTRUCTURE", [
        "Flagship Default AI Engine: Google GenAI SDK (@google/genai)",
        "gemini-3.7-flash — Next-gen hybrid reasoning & lightning-fast code generation",
        "gemini-3.7-pro — Deep architectural planning, self-debate analysis & complex refactors",
        "gemini-3.5-pro & gemini-2.5-flash — Extended context & automated verification fallback",
        "Multi-Provider Resilient Fallback: OpenAI (gpt-4o, o3-mini) · Anthropic (claude-3-7-sonnet) · DeepSeek · Local Ollama",
        "Google Cloud Run Backend: Production container deployment with process.env.PORT & dynamic host bindings",
        "Built-in Health Checks: /api/health endpoint for Cloud Run uptime monitoring and auto-scaling",
        "Server-Side Key Injection: Instant zero-config judging environment for Google Hackathon reviewers",
        "Streaming Architecture: Direct Server-Sent Events (SSE) with fragment chunk buffer persistence"
    ], "GOOGLE CORE")

    draw_box(1310, bot_y, bot_w, bot_h, "MULTI-TIERED LIFELONG MEMORY & CLOUD FIRESTORE PERSISTENCE", [
        "Thinking Profiles Store: Multi-profile Markdown blueprints (~/.antri/profiles/profile_1.md)",
        "Semantic Vector Memory: Dense 128-dimensional embedding space with cosine similarity recall",
        "Episodic Session Store: Transcript histories, debate logs, goal iterations, and conversation trees",
        "Workspace Conventions Memory: Repository-specific architectural patterns (~/.antri/conventions.md)",
        "Google Cloud Firestore Sync: Real-time bi-directional state synchronization across Mobile, CLI & Desktop",
        "Artifact Storage Hub: Persistent storage for BugTwin sandboxes, CrashZero replays, and mind maps",
        "Offline-First Resilience: Local JSON snapshot fallback when disconnected from Cloud Firestore",
        "Knowledge Compounding Loop: Autonomous memory reflection and rule consolidation (/consolidate, /learn)"
    ], "PERSISTENCE")

    # Bottom Footer
    footer_text = "ANTRI Code Ecosystem · TypeScript (NodeNext / ESM) + Flutter/Dart · Published on npm (antri_cli) · Apache-2.0 / MIT"
    draw.text((width // 2, height - 45), footer_text, fill="black", font=font_small, anchor="mm")

    # Save outputs
    os.makedirs("assets", exist_ok=True)
    out_path = os.path.abspath("assets/architecture_diagram.png")
    out_path_bw = os.path.abspath("assets/architecture_diagram_bw.png")
    
    img.save(out_path, "PNG")
    img.save(out_path_bw, "PNG")
    print(f"Successfully generated perfect black and white architecture diagram: {out_path}")

if __name__ == "__main__":
    create_bw_architecture_diagram()
