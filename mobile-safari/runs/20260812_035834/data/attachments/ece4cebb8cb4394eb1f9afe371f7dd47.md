# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: auth.spec.ts >> Registration @auth >> should register and then logout successfully
- Location: tests/e2e/auth.spec.ts:58:7

# Error details

```
Error: page.goto: Navigation to "http://localhost:3000/settings" is interrupted by another navigation to "http://localhost:3000/"
Call log:
  - navigating to "http://localhost:3000/settings", waiting until "load"

```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e2]:
    - navigation [ref=e3]:
      - generic:
        - link "conduit" [ref=e4]:
          - /url: /
        - list [ref=e5]:
          - listitem [ref=e6]:
            - link "Home" [ref=e7]:
              - /url: /
          - listitem [ref=e8]:
            - link "Sign in" [ref=e9]:
              - /url: /login
          - listitem [ref=e10]:
            - link "Sign up" [ref=e11]:
              - /url: /register
    - generic [ref=e12]:
      - generic [ref=e14]:
        - heading "conduit" [level=1] [ref=e15]
        - paragraph [ref=e16]: A place to share your knowledge.
      - generic [ref=e18]:
        - generic [ref=e19]:
          - list [ref=e21]:
            - listitem [ref=e22]:
              - link "Your Feed" [ref=e23]:
                - /url: /?feedType=feed
            - listitem [ref=e24]:
              - link "Global Feed" [ref=e25]:
                - /url: /?feedType=global
          - generic [ref=e26]:
            - generic [ref=e27]:
              - link:
                - /url: /profile/globalTestUser
              - generic [ref=e28]:
                - link "globalTestUser" [ref=e29]:
                  - /url: /profile/globalTestUser
                - generic [ref=e30]: August 12, 2026
              - button " 0" [ref=e31] [cursor=pointer]:
                - generic [ref=e32]: 
                - text: "0"
            - link "Updated Article Title Updated description for testing. Read more... test" [ref=e33]:
              - /url: /article/updated-article-title-1
              - heading "Updated Article Title" [level=1] [ref=e34]
              - paragraph [ref=e35]: Updated description for testing.
              - text: Read more...
              - list [ref=e36]:
                - listitem [ref=e37]: test
          - generic [ref=e38]:
            - generic [ref=e39]:
              - link "Author profile picture" [ref=e40]:
                - /url: /profile/gutentag2012
                - img "Author profile picture" [ref=e41]
              - generic [ref=e42]:
                - link "gutentag2012" [ref=e43]:
                  - /url: /profile/gutentag2012
                - generic [ref=e44]: May 24, 2024
              - button " 1" [ref=e45] [cursor=pointer]:
                - generic [ref=e46]: 
                - text: "1"
            - link "This is my article alot Read more... another here tag" [ref=e47]:
              - /url: /article/this-is-my-article-2
              - heading "This is my article" [level=1] [ref=e48]
              - paragraph [ref=e49]: alot
              - text: Read more...
              - list [ref=e50]:
                - listitem [ref=e51]: another
                - listitem [ref=e52]: here
                - listitem [ref=e53]: tag
          - generic [ref=e54]:
            - generic [ref=e55]:
              - link "Author profile picture" [ref=e56]:
                - /url: /profile/Maksim%20Esteban
                - img "Author profile picture" [ref=e57]
              - generic [ref=e58]:
                - link "Maksim Esteban" [ref=e59]:
                  - /url: /profile/Maksim%20Esteban
                - generic [ref=e60]: January 4, 2024
              - button " 0" [ref=e61] [cursor=pointer]:
                - generic [ref=e62]: 
                - text: "0"
            - link "Ill quantify the redundant TCP bus, that should hard drive the ADP bandwidth! Aut facilis qui. Cupiditate sit ratione eum sunt rerum impedit. Qui suscipit debitis et et voluptates voluptatem voluptatibus. Quas voluptatum quae corporis corporis possimus. Read more... consequuntur nihil reiciendis sit" [ref=e63]:
              - /url: /article/Ill-quantify-the-redundant-TCP-bus-that-should-hard-drive-the-ADP-bandwidth!-553
              - heading "Ill quantify the redundant TCP bus, that should hard drive the ADP bandwidth!" [level=1] [ref=e64]
              - paragraph [ref=e65]: Aut facilis qui. Cupiditate sit ratione eum sunt rerum impedit. Qui suscipit debitis et et voluptates voluptatem voluptatibus. Quas voluptatum quae corporis corporis possimus.
              - text: Read more...
              - list [ref=e66]:
                - listitem [ref=e67]: consequuntur
                - listitem [ref=e68]: nihil
                - listitem [ref=e69]: reiciendis
                - listitem [ref=e70]: sit
          - generic [ref=e71]:
            - generic [ref=e72]:
              - link "Author profile picture" [ref=e73]:
                - /url: /profile/Maksim%20Esteban
                - img "Author profile picture" [ref=e74]
              - generic [ref=e75]:
                - link "Maksim Esteban" [ref=e76]:
                  - /url: /profile/Maksim%20Esteban
                - generic [ref=e77]: January 4, 2024
              - button " 0" [ref=e78] [cursor=pointer]:
                - generic [ref=e79]: 
                - text: "0"
            - link "The JSON interface is down, hack the haptic transmitter so we can bypass the XML system! Odit consequatur nobis aut quo dolores in adipisci praesentium. Quod rerum ducimus ad. Ut autem velit consequatur nihil animi animi architecto. Quaerat et sed. Read more... neque nostrum voluptatem" [ref=e80]:
              - /url: /article/The-JSON-interface-is-down-hack-the-haptic-transmitter-so-we-can-bypass-the-XML-system!-553
              - heading "The JSON interface is down, hack the haptic transmitter so we can bypass the XML system!" [level=1] [ref=e81]
              - paragraph [ref=e82]: Odit consequatur nobis aut quo dolores in adipisci praesentium. Quod rerum ducimus ad. Ut autem velit consequatur nihil animi animi architecto. Quaerat et sed.
              - text: Read more...
              - list [ref=e83]:
                - listitem [ref=e84]: neque
                - listitem [ref=e85]: nostrum
                - listitem [ref=e86]: voluptatem
          - generic [ref=e87]:
            - generic [ref=e88]:
              - link "Author profile picture" [ref=e89]:
                - /url: /profile/Maksim%20Esteban
                - img "Author profile picture" [ref=e90]
              - generic [ref=e91]:
                - link "Maksim Esteban" [ref=e92]:
                  - /url: /profile/Maksim%20Esteban
                - generic [ref=e93]: January 4, 2024
              - button " 0" [ref=e94] [cursor=pointer]:
                - generic [ref=e95]: 
                - text: "0"
            - link "Ill compress the optical SDD hard drive, that should interface the XSS bandwidth! Pariatur ut dolor repellendus dolores ut debitis. Est iusto neque dicta voluptatibus quia nulla consequatur. Omnis aut sed dolores qui laborum a amet. Read more... consequatur labore neque occaecati" [ref=e96]:
              - /url: /article/Ill-compress-the-optical-SDD-hard-drive-that-should-interface-the-XSS-bandwidth!-553
              - heading "Ill compress the optical SDD hard drive, that should interface the XSS bandwidth!" [level=1] [ref=e97]
              - paragraph [ref=e98]: Pariatur ut dolor repellendus dolores ut debitis. Est iusto neque dicta voluptatibus quia nulla consequatur. Omnis aut sed dolores qui laborum a amet.
              - text: Read more...
              - list [ref=e99]:
                - listitem [ref=e100]: consequatur
                - listitem [ref=e101]: labore
                - listitem [ref=e102]: neque
                - listitem [ref=e103]: occaecati
          - list [ref=e104]:
            - listitem:
              - link "1" [ref=e105]:
                - /url: /?offset=1
            - listitem:
              - link "2" [ref=e106]:
                - /url: /?offset=2
            - listitem:
              - link "3" [ref=e107]:
                - /url: /?offset=3
            - listitem:
              - generic: ...
            - listitem:
              - link "81" [ref=e108]:
                - /url: /?offset=81
        - paragraph [ref=e111]: Popular Tags
    - contentinfo [ref=e117]:
      - generic [ref=e118]:
        - link "conduit" [ref=e119]:
          - /url: /
        - generic [ref=e120]:
          - text: An interactive learning project from
          - link "Thinkster" [ref=e121]:
            - /url: https://thinkster.io
          - text: . Code & design licensed under MIT.
  - alert [ref=e122]
```

# Test source

```ts
  1  | /**
  2  |  * BasePage — base class for all Page Objects.
  3  |  *
  4  |  * Holds the `page` instance and provides shared navigation helpers.
  5  |  * Every Page Object extends this class and receives `page` via constructor.
  6  |  */
  7  | 
  8  | import { type Page, type Locator } from '@playwright/test';
  9  | 
  10 | export class BasePage {
  11 |   readonly page: Page;
  12 | 
  13 |   /* Common navigation elements (visible on every page) */
  14 |   readonly navHome: Locator;
  15 |   readonly navSignIn: Locator;
  16 |   readonly navSignUp: Locator;
  17 |   readonly navNewArticle: Locator;
  18 |   readonly navSettings: Locator;
  19 | 
  20 |   constructor(page: Page) {
  21 |     this.page = page;
  22 | 
  23 |     /* Guest nav links */
  24 |     this.navHome = page.getByRole('link', { name: 'Home' });
  25 |     this.navSignIn = page.getByRole('link', { name: 'Sign in' });
  26 |     this.navSignUp = page.getByRole('link', { name: 'Sign up' });
  27 | 
  28 |     /* Authenticated nav links */
  29 |     this.navNewArticle = page.getByRole('link', { name: 'New Article' });
  30 |     this.navSettings = page.getByRole('link', { name: 'Settings' });
  31 |   }
  32 | 
  33 |   /* Navigate to a path relative to baseURL */
  34 |   async goto(path = '/') {
> 35 |     await this.page.goto(path);
     |                     ^ Error: page.goto: Navigation to "http://localhost:3000/settings" is interrupted by another navigation to "http://localhost:3000/"
  36 |   }
  37 | 
  38 |   /* Get the nav link to the current user's profile (dynamic text) */
  39 |   getNavProfile(username: string): Locator {
  40 |     return this.page.locator('.navbar').getByRole('link', { name: username });
  41 |   }
  42 | 
  43 |   /* Get error messages displayed on forms (ul.error-messages > li) */
  44 |   get errorMessages(): Locator {
  45 |     return this.page.locator('.error-messages li');
  46 |   }
  47 | 
  48 |   /* Wait for navigation to complete (URL contains the expected path) */
  49 |   async waitForURL(path: string) {
  50 |     await this.page.waitForURL(`**${path}**`);
  51 |   }
  52 | }
```