import { chromium, Browser, Page, BrowserContext } from "playwright-core";
import path from "path";

export interface ExtractionResult {
  url: string;
  title: string;
  interactiveElements: any;
}

class BrowserService {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;

  async ensureBrowser() {
    if (!this.browser) {
      this.browser = await chromium.launch({
        headless: false,
        args: ["--window-size=1440,900", "--disable-blink-features=AutomationControlled"],
      });
      this.context = await this.browser.newContext({
        viewport: { width: 1440, height: 900 },
        userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        recordVideo: {
          dir: path.join(process.cwd(), ".recordings"),
          size: { width: 1440, height: 900 }
        }
      });
      this.page = await this.context.newPage();
      
      await this.page.addInitScript(() => {
        const style = document.createElement("style");
        style.innerHTML = `
          .jim-element-highlight {
            outline: 4px solid #ff9500 !important;
            outline-offset: 2px !important;
            box-shadow: 0 0 20px rgba(255, 149, 0, 0.8) !important;
            transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1) !important;
            z-index: 1000000 !important;
          }
          @keyframes jim-ripple {
            0% { transform: translate(-50%, -50%) scale(0); opacity: 0.8; }
            100% { transform: translate(-50%, -50%) scale(4); opacity: 0; }
          }
          .jim-ripple-effect {
            position: fixed; border-radius: 50%; background: rgba(255, 149, 0, 0.4);
            border: 2px solid #ff9500; pointer-events: none; z-index: 1000001;
            animation: jim-ripple 0.6s ease-out forwards;
          }
          @keyframes jim-foggy-pulse {
            0% { opacity: 0.3; box-shadow: inset 0 0 50px rgba(255,149,0,0.4), 0 0 20px rgba(255,149,0,0.2); }
            50% { opacity: 0.8; box-shadow: inset 0 0 100px rgba(255,149,0,0.7), 0 0 40px rgba(255,149,0,0.5); }
            100% { opacity: 0.3; box-shadow: inset 0 0 50px rgba(255,149,0,0.4), 0 0 20px rgba(255,149,0,0.2); }
          }
          .jim-foggy-border {
            animation: jim-foggy-pulse 4s ease-in-out infinite;
          }
          .jim-action-label {
            position: absolute; background: #ff9500; color: #000;
            padding: 2px 8px; border-radius: 4px; font-family: Inter, sans-serif;
            font-size: 10px; font-weight: bold; pointer-events: none;
            z-index: 1000002; white-space: nowrap;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            transform: translateY(-100%) translateY(-8px);
          }
          @keyframes jim-rec-pulse { 0% { opacity: 1; } 50% { opacity: 0.3; } 100% { opacity: 1; } }
        `;
        document.head.appendChild(style);
      });
    }
    return { browser: this.browser, context: this.context!, page: this.page! };
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.context = null;
      this.page = null;
    }
  }

  async getPage() {
    const { page } = await this.ensureBrowser();
    return page;
  }

  async updateHUD(status: string, icon: string = "🧭") {
    const page = await this.getPage();
    try {
      const urlStr = page.url();
      await page.evaluate(({text, icon, url}) => {
        let overlay = document.getElementById("jim-overlay") || document.createElement("div");
        if (!overlay.id) {
          overlay.id = "jim-overlay";
          Object.assign(overlay.style, {
            position: "fixed", inset: "0", border: "4px solid rgba(255, 149, 0, 0.4)",
            pointerEvents: "none", zIndex: "999998", transition: "all 0.5s ease",
          });
          overlay.className = "jim-foggy-border";
          document.body.appendChild(overlay);
        }

        let hud = document.getElementById("jim-hud") || document.createElement("div");
        if (!hud.id) {
          hud.id = "jim-hud";
          Object.assign(hud.style, {
            position: "fixed", bottom: "40px", left: "50%", transform: "translateX(-50%)",
            background: "rgba(15, 15, 15, 0.95)", border: "1px solid #ff9500",
            color: "white", padding: "12px 28px", borderRadius: "50px",
            fontFamily: "Inter, system-ui", fontSize: "14px", fontWeight: "600",
            boxShadow: "0 15px 45px rgba(0,0,0,0.8)", zIndex: "999999",
            display: "flex", gap: "12px", alignItems: "center",
          });
          hud.innerHTML = `
            <span id="jim-icon"></span>
            <span id="jim-text"></span>
            <span style="color:rgba(255,149,0,0.5);font-size:11px;margin-left:10px" id="jim-url"></span>
            <span style="margin-left:15px;color:#ff3b30;font-size:10px;font-weight:bold;display:flex;align-items:center;gap:4px" id="jim-rec">
              <span style="width:6px;height:6px;background:#ff3b30;border-radius:50%;display:inline-block;animation:jim-rec-pulse 1s infinite"></span> REC
            </span>
          `;
          document.body.appendChild(hud);
        }
        
        const tEl = hud.querySelector("#jim-text");
        const iEl = hud.querySelector("#jim-icon");
        const uEl = hud.querySelector("#jim-url");
        if (tEl) tEl.textContent = text;
        if (iEl) iEl.textContent = icon;
        if (uEl) uEl.textContent = url ? url.substring(0, 40) + "..." : "";
      }, {text: status, icon, url: urlStr});
    } catch (e) {}
  }

  async clearHUD() {
    const page = await this.getPage();
    await page.evaluate(() => {
      const h = document.getElementById("jim-hud");
      const o = document.getElementById("jim-overlay");
      if (h) h.remove();
      if (o) o.remove();
    }).catch(() => {});
  }

  async showRipple(x: number, y: number) {
    const page = await this.getPage();
    await page.evaluate(({x, y}) => {
      const r = document.createElement("div");
      r.className = "jim-ripple-effect";
      Object.assign(r.style, { left: x + "px", top: y + "px", width: "40px", height: "40px" });
      document.body.appendChild(r);
      setTimeout(() => r.remove(), 600);
    }, {x, y}).catch(() => {});
  }

  async highlight(selector: string, actionText: string = "Targeting", duration = 1200) {
    const page = await this.getPage();
    await page.evaluate(({sel, dur, text}) => {
      const el = document.querySelector(sel) as HTMLElement;
      if (el) {
        el.classList.add("jim-element-highlight");
        el.scrollIntoView({ behavior: "smooth", block: "center" });

        const label = document.createElement("div");
        label.className = "jim-action-label";
        label.textContent = text;
        document.body.appendChild(label);

        const updatePos = () => {
          const rect = el.getBoundingClientRect();
          label.style.left = (rect.left + window.scrollX) + "px";
          label.style.top = (rect.top + window.scrollY) + "px";
        };
        updatePos();
        
        setTimeout(() => {
          el.classList.remove("jim-element-highlight");
          label.remove();
        }, dur);
      }
    }, {sel: selector, dur: duration, text: actionText}).catch(() => {});
  }

  async click(selector: string, button: "left" | "right" | "middle" = "left") {
    const page = await this.getPage();
    await this.highlight(selector, "Clicking", 1200).catch(() => {});
    const box = await page.locator(selector).first().boundingBox().catch(() => null);
    if (box) await this.showRipple(box.x + box.width / 2, box.y + box.height / 2).catch(() => {});
    await this.updateHUD(`Clicking...`, "🖱️");
    await page.click(selector, { button }).catch(() => {});
    await page.waitForLoadState("domcontentloaded").catch(() => {});
  }

  async type(selector: string, text: string) {
    const page = await this.getPage();
    await this.highlight(selector, "Typing", 1500).catch(() => {});
    await this.updateHUD(`Typing...`, "⌨️");
    await page.fill(selector, "").catch(() => {});
    await page.type(selector, text, { delay: 40 }).catch(() => {});
  }

  async smoothScroll(direction: "up" | "down" | "top" | "bottom", amount?: number) {
    const page = await this.getPage();
    await this.updateHUD(`Scrolling...`, "↕️");
    await page.evaluate(({dir, amt}) => {
      const d = amt || window.innerHeight * 0.7;
      let t = window.scrollY;
      if (dir === "top") t = 0;
      else if (dir === "bottom") t = document.body.scrollHeight;
      else if (dir === "up") t = Math.max(0, window.scrollY - d);
      else t = window.scrollY + d;
      window.scrollTo({ top: t, behavior: "smooth" });
    }, {dir: direction, amt: amount}).catch(() => {});
    await page.waitForTimeout(800);
  }

  async extractContent(): Promise<ExtractionResult> {
    const page = await this.getPage();
    await this.updateHUD("Extracting...", "🔍");
    
    const extractionCode = `(() => {
      const getPath = (el) => {
        if (el.id) return '#' + CSS.escape(el.id);
        let p = el.tagName.toLowerCase();
        if (el.parentElement) {
          const idx = Array.from(el.parentElement.children).indexOf(el) + 1;
          p = getPath(el.parentElement) + " > " + p + ":nth-child(" + idx + ")";
        }
        return p;
      };

      const scan = (el, depth = 0) => {
        if (depth > 8) return null;
        const rect = el.getBoundingClientRect();
        if (rect.width < 1 || rect.height < 1) return null;
        const style = window.getComputedStyle(el);
        if (style.display === 'none' || style.visibility === 'hidden') return null;

        const tag = el.tagName.toLowerCase();
        const role = el.getAttribute("role") || "";
        const label = el.getAttribute("aria-label") || el.getAttribute("title") || el.getAttribute("alt") || "";
        
        const isInteractive = ["button", "a", "input", "select", "textarea"].includes(tag) || 
                             !!role || !!el.getAttribute("onclick") || 
                             style.cursor === "pointer";

        const text = el.children.length === 0 ? el.textContent?.trim().slice(0, 300) : "";
        
        const res = { tag };
        if (isInteractive) {
           res.interactive = true;
           res.selector = getPath(el);
           if (label) res.label = label;
           if (role) res.role = role;
        }
        if (text) res.text = text;

        const children = Array.from(el.children)
          .map(c => scan(c, depth + 1))
          .filter(Boolean);
          
        if (children.length > 0) res.children = children;
        return (res.interactive || res.text || res.children) ? res : null;
      };

      return {
        url: window.location.href,
        title: document.title,
        interactiveElements: scan(document.body)
      };
    })()`;

    const data = await page.evaluate(extractionCode) as ExtractionResult;
    return data;
  }

  async screenshot(filePath?: string) {
    const page = await this.getPage();
    const p = filePath || path.join(process.cwd(), "screenshot-" + Date.now() + ".png");
    await page.screenshot({ path: p, fullPage: false });
    return p;
  }
}

export const browserService = new BrowserService();
