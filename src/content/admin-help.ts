/**
 * The 12 in-product help articles docs/09-ADMIN-DAD-MODE.md §10 requires
 * ("each ≤ 400 words, screenshots included... written as part of the
 * build, stored in `docs/admin-help/` and rendered in-app"). Rendered as
 * typed content here rather than markdown files parsed at request time:
 * this codebase has no markdown/MDX dependency anywhere yet, and adding
 * one just for twelve short articles is more new surface area than the
 * articles themselves — a plain typed array is guaranteed to render
 * correctly with zero new dependencies, and is exactly as easy for a
 * future writer to edit. Screenshots are NOT included (flagged, not
 * silently dropped) — none of this pass's help content has real product
 * screenshots to embed.
 */
export interface AdminHelpSection {
  heading?: string;
  paragraphs?: string[];
  bullets?: string[];
}

export interface AdminHelpArticle {
  slug: string;
  title: string;
  summary: string;
  sections: AdminHelpSection[];
}

export const ADMIN_HELP_ARTICLES: AdminHelpArticle[] = [
  {
    slug: "adding-your-first-product",
    title: "Adding your first product",
    summary: "Takes about 3 minutes. Go to Products, then Add a product.",
    sections: [
      {
        paragraphs: [
          "Products are added in four short steps: basic information, photos, details, and search information. You can save as a draft at any step and come back later.",
          "Step 1 asks for the name, brand, category, price, and how many you have in stock. If a similar product already exists, you'll see a warning so you don't create a duplicate.",
          "Step 2 is photos. Drag and drop as many as you like — the first one becomes the main photo shoppers see first. Products with photos sell much better, so add at least one.",
          "Step 3 shows only the details that matter for that category (for example, a laptop asks for processor and RAM; a monitor asks for screen size and resolution).",
          "Step 4 is what Google shows in search results. Two fields, both pre-filled for you — change them only if you want to.",
        ],
      },
      {
        heading: "When you're ready",
        paragraphs: [
          "Press Publish. If anything important is missing, you'll see a checklist instead of an error — you can publish anyway or go back and fix it.",
        ],
      },
    ],
  },
  {
    slug: "understanding-stock",
    title: "Understanding stock",
    summary: "Every change to a stock number is recorded, with a reason.",
    sections: [
      {
        paragraphs: [
          "Go to Stock to see how many of each product you have. Use the −1 / +1 buttons for quick changes, or Set… for a bigger change.",
          "Every change asks for a reason — Received new stock, Sold in shop, Damaged, Correction, or Returned. This means you can always see exactly what happened to your stock and when.",
          "Set a 'when to warn me' number for each product. When stock drops to that number or below, it shows up on your Today page and in the Stock list so you can reorder in time.",
        ],
      },
    ],
  },
  {
    slug: "live-and-not-published",
    title: 'What "Live" and "Not published" mean',
    summary:
      "Live means customers can see and buy it. Not published means only your team can see it.",
    sections: [
      {
        paragraphs: [
          "A product marked Live is visible on the website and customers can buy it, as long as it's in stock.",
          "Not published means the product exists in your system but customers can't see it yet — useful while you're still adding photos or details.",
          "You can switch a product back and forth between the two at any time. Hiding a product never deletes it or its order history.",
        ],
      },
    ],
  },
  {
    slug: "processing-an-order",
    title: "Processing an order start to finish",
    summary:
      "Every order moves through the same steps, shown as a bar across the top of the order.",
    sections: [
      {
        paragraphs: [
          "Open Orders and click on an order to see its details: the customer, what they bought, how they're paying, and the address.",
          "A row of buttons shows what can happen next — for example 'Confirm order' or 'Mark as packed'. Press the one that matches what you just did in real life.",
          "After you make a change, you have 10 seconds to undo it if you tapped the wrong thing.",
          "If they paid by bank transfer, check the Payment section and compare it against your bank statement before approving — never approve just from looking at the photo.",
        ],
      },
    ],
  },
  {
    slug: "checking-a-bank-transfer-safely",
    title: "Checking a bank transfer safely",
    summary: "Always check your real bank statement — never approve from the photo alone.",
    sections: [
      {
        paragraphs: [
          "When a customer pays by bank transfer, they upload a photo of their receipt. This photo is a claim, not proof — always open your own banking app or statement and confirm the exact amount actually arrived.",
          "Once you've checked, press Approve. If something looks wrong — wrong amount, blurry photo, or you can't find the transfer — press Reject and explain why.",
          "For larger payments, a second person on your team needs to approve as well, as an extra safety check.",
        ],
      },
    ],
  },
  {
    slug: "page-title-and-search-description",
    title: "What Page Title and Search Description do",
    summary:
      "These are the words Google shows in search results — they don't change anything on your website page itself.",
    sections: [
      {
        paragraphs: [
          "Page Title is the blue clickable line Google shows. Keep it under 60 characters so it doesn't get cut off.",
          "Search Description is the grey line underneath it. Keep it under 160 characters.",
          "Both are pre-filled for you based on the product name and details — you only need to change them if you want to.",
        ],
      },
    ],
  },
  {
    slug: "adding-photos-that-look-good",
    title: "Adding photos that look good",
    summary: "Good lighting and a plain background make the biggest difference.",
    sections: [
      {
        paragraphs: [
          "Drag and drop photos, or click to choose them — you can also paste a photo you've copied, or take one directly on your phone.",
          "The first photo you add becomes the main photo shown on the website and in search results — pick your clearest, best-lit shot for that one.",
          "Every photo gets a short 'photo description' — a sentence describing what's in it (for example, 'HP Victus 15 gaming laptop, front view'). This helps people who use screen readers, and helps your products show up in Google Images.",
          "If you upload the same photo twice, we'll let you know so you don't end up with duplicates.",
        ],
      },
    ],
  },
  {
    slug: "creating-a-discount-code",
    title: "Creating a discount code",
    summary: "Go to Discount codes, then Add a discount code.",
    sections: [
      {
        paragraphs: [
          "Choose a code customers will type at checkout (for example DASHAIN10), the type of discount — a percentage off, a fixed amount off, or free shipping — and how much.",
          "You can limit it to a minimum order amount, a maximum number of uses, a date range, or only a customer's first order.",
          "Turn a code off at any time without deleting it — you can turn it back on later if you want to reuse it.",
        ],
      },
    ],
  },
  {
    slug: "understanding-the-today-page",
    title: "Understanding the Today page",
    summary:
      "This is the first thing you see — it answers the questions you'd normally have to check five different places for.",
    sections: [
      {
        paragraphs: [
          "The top row shows orders today, money today, what needs your attention, and what's almost out of stock — big numbers, so you can tell what's going on in three seconds.",
          "Below that is an actual to-do list — things like 'payments to check' or 'products with no photo' — each with a button that takes you straight to that list.",
          "Further down you'll see this week and this month compared to the period before, your best sellers, and your newest customers.",
          "Every number on this page is clickable — press it to see the full list behind it.",
        ],
      },
    ],
  },
  {
    slug: "managing-repair-jobs",
    title: "Managing repair jobs",
    summary: "Go to Repairs to see every device your team is fixing, from drop-off to pickup.",
    sections: [
      {
        paragraphs: [
          "Press '+ New repair job' when a customer drops off a device — enter their details, the device, and what's wrong with it. This gives the job a number you and the customer can use to track it.",
          "As work happens, move the job forward — Start diagnosing, Mark quote sent, Start repair, and so on — the same way you update an order.",
          "Use the internal notes to leave details for the next technician, and mark the job Ready for pickup once it's done so it shows up on your Today page.",
        ],
      },
    ],
  },
  {
    slug: "adding-a-new-staff-member",
    title: "Adding a new staff member and what each role can do",
    summary: "Go to Staff accounts, then Add a staff member. Only an Owner can do this.",
    sections: [
      {
        paragraphs: [
          "Enter their name, a phone number or email, and choose a role. Each role's description is shown right there so you know exactly what you're giving them access to.",
        ],
      },
      {
        heading: "The roles",
        bullets: [
          "Owner — can do everything, including changing settings and adding staff.",
          "Manager — can manage products, orders, stock and content. Cannot change settings or add staff.",
          "Shop staff — can process orders and update stock. Cannot change prices or delete anything.",
          "Content writer — can write blog posts and edit website pages. Cannot see orders or customers.",
          "Customer support — can view orders and customers and reply to messages. Cannot change anything else.",
          "Repair technician — can manage repair jobs only.",
        ],
      },
      {
        paragraphs: [
          "After adding someone, you'll see a temporary password once — write it down and give it to them so they can sign in.",
        ],
      },
    ],
  },
  {
    slug: "when-something-looks-wrong",
    title: "What to do when something looks wrong",
    summary: "Most mistakes here can be undone — nothing is ever silently lost.",
    sections: [
      {
        paragraphs: [
          "If you just changed an order's status, look for the 'Undo' button in the message that appears at the bottom of the screen — it stays there for 10 seconds.",
          "If you hid a product or turned off a discount code by mistake, you can always turn it back on — nothing is deleted.",
          "If a number on a page looks wrong, click it — it takes you to the real list behind it so you can check for yourself.",
          "Every change anyone on your team makes is recorded in Activity History (Owner only), with who did it and when, so you can always see what happened.",
          "If you're still stuck, contact whoever built your website with the page you were on and what you were trying to do.",
        ],
      },
    ],
  },
];

export function getAdminHelpArticle(slug: string): AdminHelpArticle | undefined {
  return ADMIN_HELP_ARTICLES.find((article) => article.slug === slug);
}
