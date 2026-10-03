/**
 * @file Wiki Hover
 * @description Hover over a link to see the content of the link
 * Doesn't work on mobile and header
 * @see tippy https://atomiks.github.io/tippyjs/
 */

const blogURL = document.querySelector('meta[name="site_url"]')
  ? document.querySelector('meta[name="site_url"]').content
  : location.origin;

/**
 * @description Replace broken image with encoded image in first para
 * @param {Element} firstPara
 * @returns {Element} firstPara
 */
function brokenImage(firstPara) {
  const brokenImage = firstPara?.querySelectorAll("img");
  if (brokenImage) {
    for (let i = 0; i < brokenImage.length; i++) {
      const encodedImage = brokenImage[i];
      encodedImage.src = decodeURI(decodeURI(encodedImage.src));
      encodedImage.src = encodedImage.src.replace(
        location.origin,
        blogURL
      );
    }
  }
  return firstPara
}

/**
 * Strip text of first para of unwanted characters
 * @param {Element} firstPara
 * @returns {Element} firstPara
 */
function cleanText(firstPara) {
  firstPara.innerText = firstPara.innerText
    .replaceAll("↩", "")
    .replaceAll("¶", "");
  return firstPara
}

function calculateHeight(firstPara) {
  const paragraph = firstPara ? firstPara.innerText ? firstPara.innerText : firstPara : "";
  const height = Math.floor(
    paragraph.split(" ").length / 100
  );
  if (height < 2) {
    return `auto`;
  } else if (height >= 5) {
    return `20rem`;
  }
  return `${height}rem`;
}

/**
 * 筛选正文内的有效内部链接 + 脚注链接
 * @returns {Element[]} 符合条件的链接元素数组
 */
function getInternalLinks() {
  const contentLinks = document.querySelectorAll('.md-content a');
  const footnoteLinks = document.querySelectorAll('a.footnote-ref');
  const allLinks = [...contentLinks, ...footnoteLinks];

  return Array.from(allLinks).filter(link => {
    const href = link.getAttribute('href');
    if (!href) return false;

    // 排除功能性按钮（复制按钮、标题锚点图标等）
    if (link.closest('.md-content__button')) return false;
    // 排除纯锚点跳转
    if (href.startsWith('#')) return false;
    // 排除外部链接
    if (/^https?:\/\//.test(href) && !href.startsWith(location.origin)) return false;

    return true;
  });
}

function initWikiHover() {
  try {
    // 销毁旧实例，避免重复绑定
    if (window.tippy && tippy.instances) {
      tippy.instances.forEach(instance => instance.destroy());
    }

    const targetLinks = getInternalLinks();
    if (targetLinks.length === 0) return;

    tippy(targetLinks, {
      content: "",
      allowHTML: true,
      animation: "scale-subtle",
      theme: "translucent",
      followCursor: true,
      arrow: false,
      touch: "hold",
      inlinePositioning: true,
      placement: 'top',
      // Popper 自动翻转与边界避让
      popperOptions: {
        modifiers: [
          {
            name: 'flip',
            options: {
              fallbackPlacements: ['bottom', 'right', 'left'],
              padding: 12
            }
          },
          {
            name: 'preventOverflow',
            options: {
              padding: 12,
              boundary: 'viewport'
            }
          }
        ]
      },
      onShow(instance) {
        fetch(instance.reference.href)
          .then((response) => response.text())
          .then((html) => {
            const parser = new DOMParser();
            return parser.parseFromString(html, "text/html");
          })
          .then((doc) => {
            // 按标题拆分内容区块
            const headers = doc.querySelectorAll("h1, h2, h3, h4, h5, h6");
            headers.forEach(function (header) {
              const headerName = header.id || header.innerText.split("\n")[0].toLowerCase().replaceAll(" ", "-");
              if (headerName.length > 0) {
                const div = doc.createElement("div");
                div.classList.add(headerName);
                let nextElement = header.nextElementSibling;
                while (nextElement && !nextElement.matches("h1, h2, h3, h4, h5, h6")) {
                  div.appendChild(nextElement);
                  nextElement = nextElement.nextElementSibling;
                }
                header.parentNode.insertBefore(div, header.nextSibling);
              }
            });
            return doc;
          })
          .then((doc) => {
            // 当前页面链接不显示预览
            if (location.href.replace(location.hash, "") === instance.reference.href) {
              instance.hide();
              instance.destroy();
              return;
            }

            let firstPara = doc.querySelector("article");
            const firstHeader = doc.querySelector("h1");

            // Index 页面显示真实文件名
            if (firstHeader && firstHeader.innerText === "Index") {
              const realFileName = decodeURI(
                doc.querySelector('link[rel="canonical"]').href
              )
                .split("/")
                .filter((e) => e)
                .pop();
              firstHeader.innerText = realFileName;
            }

            firstPara = brokenImage(firstPara);

            const element1 = document.querySelector(`[id^="tippy"]`);
            if (element1) {
              element1.classList.add("tippy");
            }

            const partOfText = instance.reference.href.replace(/.*#/, "#");
            let toDisplay = firstPara;
            let displayType;

            if (partOfText.startsWith("#")) {
              firstPara = doc.querySelector(
                `[id="${partOfText.replace("#", "")}"]`
              );
              if (firstPara.tagName.includes("H")) {
                const articleDOM = doc.createElement("article");
                articleDOM.classList.add("md-content__inner", "md-typeset");
                articleDOM.appendChild(doc.querySelector(`div.${partOfText.replace("#", "")}`));
                toDisplay = articleDOM;
                firstPara = toDisplay;
              } else if (firstPara.innerText.replace(partOfText).length === 0) {
                firstPara = doc.querySelector("div.citation");
                toDisplay = firstPara;
              } else {
                toDisplay = cleanText(firstPara).innerText;
              }
              instance.popper.style.height = "auto";
            } else {
              instance.popper.style.height = calculateHeight(firstPara);
            }

            // 根据内容长度动态调整首选方向
            const textLength = firstPara?.innerText?.length || 0;
            if (textLength > 500) {
              instance.setProps({ placement: 'right' });
            } else {
              instance.setProps({ placement: 'top' });
            }

            if (firstPara.innerText.length > 0) {
              if (!displayType) {
                instance.setContent(toDisplay)
                instance.popper.style.height = calculateHeight(toDisplay);
              }
            } else {
              firstPara = doc.querySelector("article");
              instance.reference.href.replace(/.*#/, "#");
              instance.popper.style.height = calculateHeight(firstPara);
            }

            // 内容渲染完成后强制重新计算位置
            requestAnimationFrame(() => {
              instance.popperInstance?.update();
            });
          })
          .catch((error) => {
            console.log(error);
            instance.hide();
            instance.destroy();
          });
      },
    });
  } catch {
    console.log("tippy error, ignore it");
  }
}

// 适配加载时机
if (typeof document$ !== 'undefined') {
  // Material 主题 instant 即时导航模式
  document$.subscribe(initWikiHover);
} else {
  // 普通页面加载
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initWikiHover);
  } else {
    initWikiHover();
  }
}
