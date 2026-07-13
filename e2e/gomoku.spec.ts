import { Browser, Page, expect, test } from "@playwright/test";

async function createJoinedRoom(browser: Browser) {
  const creatorContext = await browser.newContext();
  const joinerContext = await browser.newContext();
  const creatorPage = await creatorContext.newPage();
  const joinerPage = await joinerContext.newPage();

  await creatorPage.goto("/");
  await expect(creatorPage.getByText("游戏服务器已连接")).toBeVisible({ timeout: 30_000 });
  await creatorPage.getByLabel("你的昵称").fill("创建者");
  await creatorPage.getByRole("button", { name: "创建棋局" }).click();
  await expect(creatorPage.getByRole("button", { name: "离开棋局" })).toBeVisible();

  const roomUrl = creatorPage.url();
  await joinerPage.goto(roomUrl);
  await expect(joinerPage.getByText("游戏服务器已连接")).toBeVisible({ timeout: 30_000 });
  await joinerPage.getByLabel("昵称").fill("加入者");
  await joinerPage.getByRole("button", { name: "加入棋局" }).click();

  await expect(creatorPage.getByText("创建者")).toBeVisible();
  await expect(creatorPage.getByText("加入者")).toBeVisible();
  await expect(creatorPage.getByText(/你执(黑|白)/)).toBeVisible({ timeout: 10_000 });
  await expect(joinerPage.getByText(/你执(黑|白)/)).toBeVisible({ timeout: 10_000 });
  await expect(
    creatorPage.locator("p.status-text").filter({ hasText: "正在随机分配黑白" })
  ).toBeHidden({ timeout: 10_000 });

  const creatorIsBlack = await creatorPage.getByText("你执黑").isVisible();
  const blackPage = creatorIsBlack ? creatorPage : joinerPage;
  const whitePage = creatorIsBlack ? joinerPage : creatorPage;
  await expect(blackPage.getByText(/轮到你落子/)).toBeVisible({ timeout: 10_000 });

  return {
    creatorContext,
    joinerContext,
    creatorPage,
    joinerPage,
    blackPage,
    whitePage,
    roomUrl
  };
}

function pointLabel(x: number, y: number) {
  return `第 ${x} 列，第 ${y} 行，空位`;
}

async function clickPoint(page: Page, x: number, y: number) {
  await page.getByRole("button", { name: pointLabel(x, y), exact: true }).press("Enter");
  await expect(page.getByText(`候选位置：第 ${x} 列，第 ${y} 行`)).toBeVisible();
  await page.locator(".placement-panel").getByRole("button", { name: "确认落子" }).click();
}

test("two players receive random colors and can place a move", async ({ browser }) => {
  const room = await createJoinedRoom(browser);
  await clickPoint(room.blackPage, 10, 10);
  await expect(room.blackPage.locator(".stone.black")).toHaveCount(1);
  await room.creatorContext.close();
  await room.joinerContext.close();
});

test("a third participant joins as spectator and can chat", async ({ browser }) => {
  const room = await createJoinedRoom(browser);
  const spectatorContext = await browser.newContext();
  const spectatorPage = await spectatorContext.newPage();
  await spectatorPage.goto(room.roomUrl);
  await spectatorPage.getByLabel("昵称").fill("观众甲");
  await spectatorPage.getByRole("button", { name: "加入棋局" }).click();
  await expect(spectatorPage.getByText("你当前在观众席")).toBeVisible();
  await spectatorPage.getByPlaceholder(/输入消息/).fill("好棋");
  await spectatorPage.getByRole("button", { name: "发送" }).click();
  await expect(spectatorPage.getByText("好棋")).toBeVisible();
  await spectatorContext.close();
  await room.creatorContext.close();
  await room.joinerContext.close();
});

test("a finished game supports rematch with swapped colors", async ({ browser }) => {
  const room = await createJoinedRoom(browser);
  for (let x = 1; x <= 4; x += 1) {
    await clickPoint(room.blackPage, x, 1);
    await clickPoint(room.whitePage, x, 2);
  }
  await clickPoint(room.blackPage, 5, 1);
  await expect(room.blackPage.getByRole("heading", { name: "黑棋获胜" })).toBeVisible();

  await room.blackPage.getByLabel("对局结果").getByRole("button", { name: "再来一局" }).click();
  await room.whitePage.getByRole("button", { name: "同意再来一局" }).click();
  await expect(room.blackPage.getByText("第 2 局")).toBeVisible();
  await expect(room.blackPage.getByText("你执白")).toBeVisible();
  await expect(room.whitePage.getByText("你执黑")).toBeVisible();

  await room.creatorContext.close();
  await room.joinerContext.close();
});

test("mobile game view keeps the board above the fixed controls and allows page scrolling before zoom", async ({ browser }) => {
  const mobileContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true
  });
  const joinerContext = await browser.newContext();
  const mobilePage = await mobileContext.newPage();
  const joinerPage = await joinerContext.newPage();

  await mobilePage.goto("/");
  await expect(mobilePage.getByText("游戏服务器已连接")).toBeVisible({ timeout: 30_000 });
  await mobilePage.getByLabel("你的昵称").fill("手机创建者");
  await mobilePage.getByRole("button", { name: "创建棋局" }).click();
  const roomUrl = mobilePage.url();

  await joinerPage.goto(roomUrl);
  await expect(joinerPage.getByText("游戏服务器已连接")).toBeVisible({ timeout: 30_000 });
  await joinerPage.getByLabel("昵称").fill("桌面加入者");
  await joinerPage.getByRole("button", { name: "加入棋局" }).click();
  await expect(mobilePage.getByText(/你执(黑|白)/)).toBeVisible({ timeout: 10_000 });
  await expect(mobilePage.locator("p.status-text").filter({ hasText: "正在随机分配黑白" })).toBeHidden({ timeout: 10_000 });

  const viewport = mobilePage.locator(".board-viewport");
  await expect(viewport).toHaveAttribute("data-zoomed", "false");
  await expect(viewport).toHaveCSS("touch-action", "pan-y");
  const boardBox = await viewport.boundingBox();
  expect(boardBox).not.toBeNull();
  expect(boardBox!.y + boardBox!.height).toBeLessThanOrEqual(770);

  await mobileContext.close();
  await joinerContext.close();
});
