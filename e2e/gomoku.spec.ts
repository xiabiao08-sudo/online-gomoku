import { Browser, Page, expect, test } from "@playwright/test";

async function createJoinedRoom(browser: Browser) {
  const blackContext = await browser.newContext();
  const whiteContext = await browser.newContext();
  const blackPage = await blackContext.newPage();
  const whitePage = await whiteContext.newPage();

  await blackPage.goto("/");
  await blackPage.getByLabel("昵称").fill("黑棋玩家");
  await blackPage.getByRole("button", { name: "创建房间" }).click();
  await expect(blackPage.getByText("房间号")).toBeVisible();

  const roomUrl = blackPage.url();
  await whitePage.goto(roomUrl);
  await whitePage.getByLabel("昵称").fill("白棋玩家");
  await whitePage.getByRole("button", { name: "加入房间" }).click();

  await expect(blackPage.getByText("黑棋玩家")).toBeVisible();
  await expect(blackPage.getByText("白棋玩家")).toBeVisible();
  await expect(whitePage.getByText("黑棋玩家")).toBeVisible();
  await expect(whitePage.getByText("白棋玩家")).toBeVisible();

  return { blackContext, whiteContext, blackPage, whitePage };
}

async function clickPoint(page: Page, label: string) {
  await page.getByRole("button", { name: label, exact: true }).click();
}

test("two players can create and join a room", async ({ browser }) => {
  const { blackContext, whiteContext } = await createJoinedRoom(browser);

  await blackContext.close();
  await whiteContext.close();
});

test("players can alternate moves and finish with black five in a row", async ({ browser }) => {
  const { blackContext, whiteContext, blackPage, whitePage } = await createJoinedRoom(browser);

  await clickPoint(blackPage, "1列1行空位");
  await clickPoint(whitePage, "1列2行空位");
  await clickPoint(blackPage, "2列1行空位");
  await clickPoint(whitePage, "2列2行空位");
  await clickPoint(blackPage, "3列1行空位");
  await clickPoint(whitePage, "3列2行空位");
  await clickPoint(blackPage, "4列1行空位");
  await clickPoint(whitePage, "4列2行空位");
  await clickPoint(blackPage, "5列1行空位");

  await expect(blackPage.getByText("黑棋获胜")).toBeVisible();
  await expect(whitePage.getByText("黑棋获胜")).toBeVisible();

  await blackPage.reload();
  await expect(blackPage.getByText("黑棋玩家")).toBeVisible();
  await expect(blackPage.getByText("黑棋获胜")).toBeVisible();

  await blackContext.close();
  await whiteContext.close();
});
