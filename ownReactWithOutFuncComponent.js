(() => {
  const ELEMENT_TYPES = {
    TEXT: 'TEXT_ELEMENT',
  }
  const EFFECT_TAGS = {
    PLACEMENT: 'PLACEMENT', // create new node
    UPDATE: 'UPDATE',
    DELETION: 'DELETION',
  }
  function createElement(type, props, ...children) {
    console.log('createElement', '\r\n');
    // return a fiber
    return {
      type,
      props: {
        ...props,
        children: children.map(child => (
          typeof child === 'object' ?
            child
            : createTextElement(child)
        )),
      },
    }
  }
  function createTextElement(text) {
    console.log('createTextElement', '\r\n');
    // return a fiber
    return {
      type: ELEMENT_TYPES.TEXT,
      props: {
        nodeValue: text,
        // P.S. React doesn’t wrap primitive values or create empty arrays when there aren’t children, but we do it because it will simplify our code, and for our library we ```prefer simple code than performant code.```
        children: [],
      },
    }
  }

  const isEvent = key => key.startsWith("on");
  const isProperty = key => key !== "children" && !isEvent(key);
  function createDom(fiber) {
    console.log('createDom', '\r\n');
    // should handle text element
    const dom = fiber.type === ELEMENT_TYPES.TEXT
      ? document.createTextNode("")
      : document.createElement(fiber.type);

    // assign element props to dom
    Object
      .keys(fiber.props)
      .filter(isProperty)
      .forEach(name => (dom[name] = fiber.props[name]));

    return dom;
  };
  const hasOwn = Object.hasOwn;
  Reflect.has
  const isGone = next => key => !hasOwn(next, key);
  const isNew = (prev, next) => key => prev[key] !== next[key];
  // const isGone = next => key => !(key in next);
  function updateDom(dom, prevProps, nextProps) {
    //Remove old or changed event listeners
    Object.keys(prevProps)
      .filter(isEvent)
      .filter(key =>
        isGone(nextProps)(key) ||
        isNew(prevProps, nextProps)(key)
      )
      .forEach(name => {
        const eventType = name.substring(2).toLowerCase();
        dom.removeEventListener(eventType, prevProps[name]);
      })

    // Remove old properties
    Object.keys(prevProps)
      .filter(isProperty)
      // PrevProps key is not in nextProps
      .filter(isGone(nextProps))
      .forEach(name => (dom[name] = ""))

    // Set new or changed properties
    Object.keys(nextProps)
      .filter(isProperty)
      // The key of prevProps and nextProps is diff
      .filter(isNew(prevProps, nextProps))
      .forEach(name => (dom[name] = nextProps[name]))

    // Add event listeners
    Object.keys(nextProps)
      .filter(isEvent)
      .filter(isNew(prevProps, nextProps))
      .forEach(name => {
        const eventType = name.substring(2).toLowerCase();
        dom.addEventListener(eventType, nextProps[name]);
      })
  }
  // Commit the whole fiber tree to the DOM.
  function commitRoot() {
    // delete fiber before commit wipRoot
    deletions.push(commitWork);
    commitWork(wipRoot.child);
    currentRoot = wipRoot;
    wipRoot = null;
  };
  function commitWork(fiber) {
    if (!fiber) return;
    if (
      fiber.effectTag === EFFECT_TAGS.PLACEMENT && fiber.dom != null
    ) {
      fiber.parent.dom.appendChild(fiber.dom);
    } else if (
      fiber.effectTag === EFFECT_TAGS.UPDATE && fiber.dom != null
    ) {
      updateDom(fiber.dom, fiber.alternate.props, fiber.props);
    } else if (fiber.effectTag === EFFECT_TAGS.DELETION) {
      fiber.parent.dom.removeChild(fiber.dom);
    }
    commitWork(fiber.child);
    commitWork(fiber.sibling);
  };
  // Render
  /**
   * We are going to break the work into small units, 
   * and after we finish each unit
   * we’ll let the browser interrupt the rendering 
   * if there’s anything else that needs to be done.
  */
  let wipRoot = null; // A pointer as workInProgressRoot
  let currentRoot = null // A pointer as last fiber tree that we committed
  let nextUnitOfWork = null;
  let deletions = null; // Tracking the fiber should be deleted
  function workLoop(deadline) {
    console.log('workLoop', '\r\n');
    let shouldYield = false;
    while (nextUnitOfWork && !shouldYield) {
      nextUnitOfWork = performUnitOfWork(nextUnitOfWork);
      shouldYield = deadline.timeRemaining() < 1;
    }

    if (!nextUnitOfWork && wipRoot) {
      commitRoot();
    };

    requestIdleCallback(workLoop);
  }
  requestIdleCallback(workLoop);
  function performUnitOfWork(fiber) {
    console.log('performUnitOfWork', '\r\n');
    // add dom node
    if (!fiber.dom) {
      fiber.dom = createDom(fiber);
    }

    // reconcile fibers from elements that was created by createElement
    const elements = fiber.props.children;
    reconcileChildren(fiber, elements);

    /**
     * return next unit of work(以 BFS 的方式)
     *  search for the next unit of work.
     *  We first try with the child, then with the sibling,
     *  then with the uncle, and so on.
    */
    // first try with the child
    // 當前 fiber child 垂直往下直衝到底
    if (fiber.child) {
      return fiber.child;
    };
    let nextFiber = fiber;
    // then with nextFiber.sibling, until without sibling
    // 此時沒有child, 開始找此 fiber.sibling, 水平直衝到底
    while (nextFiber) {
      if (nextFiber.sibling) {
        return nextFiber.sibling;
      }
      // then for search up with parentFiber.sibling as the uncle.
      // 此時fiber沒有child也沒有sibling(垂直衝到底且水平也衝到底了), 往上找父fiber的sibling, 回到125行(再把父fiber.sibling的水平也衝到底)
      nextFiber = nextFiber.parent;
    };
    // not child && not sibling && not parent, currently at root fiber
    // return undefined as nextUnitOfWork
    // 一直往上找後，直衝到此時 fiber 為 root fiber, 則 return undefined
  }
  /**
   * Reconcile diff fiber tree for update, delete, etc...
   *   wipFiber as workInProgressFiber
   *   We iterate at the same time over the children of the old fiber (wipFiber.alternate) and the array of elements we want to reconcile.
   *   
   */
  function reconcileChildren(wipFiber, elements) {
    let index = 0, prevSibling = null;
    let oldFiber = wipFiber.alternate && wipFiber.alternate.child;

    while (index < elements.length || oldFiber != null) {
      let elementFiber = null;
      const element = elements[index];
      const sameType = oldFiber && element && element.type == oldFiber.type;

      // If the old fiber && the new element && same type, 
      // we can keep the DOM node and just update it with the new props.
      if (sameType) { // update the node
        elementFiber = {
          type: oldFiber.type,
          props: element.props,
          dom: oldFiber.dom,
          parent: wipFiber,
          alternate: oldFiber,
          effectTag: EFFECT_TAGS.UPDATE,
        }
      }
      // If the type is different && there is a new element, 
      // we need to create a new fiber node
      if (element && !sameType) { // add this new fiber node
        elementFiber = {
          type: element.type,
          props: element.props,
          dom: null,
          parent: wipFiber,
          alternate: null,
          effectTag: EFFECT_TAGS.PLACEMENT,
        }
      }
      // If the types are different && there is an old fiber, 
      // we need to remove the old node
      if (oldFiber && !sameType) { // delete the oldFiber's node
        oldFiber.effectTag = EFFECT_TAGS.DELETION;
        // When we commit with wipRoot, 
        // but oldFiber from currentRoot(last fiber tree),
        // we need track deletion fiber by an array of deletions.
        deletions.push(oldFiber);
      }

      // elements[0] 對應 oldFiber(wipFiber.alternate.child)
      // elements[1..n] 作前一個的 sibling 不斷 iterator
      // 因此 oldFiber 也要換成下一個 sibling 對應到下一個 element
      if (oldFiber) {
        oldFiber = oldFiber.sibling;
      }

      // 第一個 elementFiber 作為 child
      if (index === 0) {
        wipFiber.child = elementFiber;
      } else if (element) {
        // 後續同階級的 elementFiber, 作為前一個 elementFiber 的 sibling
        prevSibling.sibling = elementFiber;
      }
      prevSibling = elementFiber;
      index++;
    }
  }
  function render(element, container) {
    console.log('render', '\r\n');
    // A pointer for track workInProgress root fiber
    wipRoot = {
      dom: container,
      props: {
        children: [element],
      },
      alternate: currentRoot,
    };
    // set init empty array for track that fiber should be deleted
    // before set root fiber to unit of work.(before performUnitOfWork start)
    deletions = [];
    // set root fiber to unit of work for built the fiber tree.
    nextUnitOfWork = wipRoot;
  }

  window.Dai = { createElement, render };

  /**
   const element = Dai.createElement(
      "div",
      { id: "foo" },
      Dai.createElement("div", null, "bar"),
      Dai.createElement("div")
    )
  */
  /** @jsx Dai.createElement */
  const element = (
    <div id="foo">
      <div>bar</div>
      <div />
    </div>
  )
  Dai.render(element, document.getElementById("root"));
})();

// 第一版的 render function, 
// problem is that recursively render will block js main thread
function render1(element, container) {
  console.log('render', '\r\n');
  // should handle text element
  const dom = element.type === ELEMENT_TYPES.TEXT
    ? document.createTextNode("")
    : document.createElement(element.type);

  // assign element props to dom
  const isProperty = key => key !== "children";
  Object
    .keys(element.props)
    .filter(isProperty)
    .forEach(name => (dom[name] = element.props[name]))

  // recursively render child, current dom as parent container
  element.props.children.forEach(child => render(child, dom));

  // append dom to container of first render callStack frame
  container.appendChild(dom);
}

// 第一版的 performUnitOfWork function, 
// 同樣這裡再建立 fiber tree 的時候，因為 appendChild 導致 js main thread block,
// 因此這裡需拆分為兩個階段，render phase(建立 fiber tree) and commit phase(一次性 commit 到 browser 上)
// In render phase, we’ll keep track of the root of the fiber tree. We call it the work in progress root or workInProgressRoot(wipRoot).
function performUnitOfWork1(fiber) {
  console.log('performUnitOfWork', '\r\n');
  // add dom node
  if (!fiber.dom) {
    fiber.dom = createDom(fiber);
  }

  if (fiber.parent) { // parentFiber
    fiber.parent.dom.appendChild(fiber.dom);
  }

  // create new fibers from elements that was created by createElement
  const elements = fiber.props.children;
  let index = 0, prevSibling = null;
  while (index < elements.length) {
    const element = elements[index];
    const newFiber = {
      type: element.type,
      props: element.props,
      parent: fiber, // current fiber as parent
      dom: null,
    }
    // 第一個 newFiber 作為 child
    if (index === 0) {
      fiber.child = newFiber;
    } else {
      // 後續同階級的 newFiber, 作為前一個 fiber 的 sibling
      prevSibling.sibling = newFiber;
    }
    prevSibling = newFiber;
    index++;
  }

  if (fiber.child) {
    return fiber.child;
  };
  let nextFiber = fiber;
  while (nextFiber) {
    if (nextFiber.sibling) {
      return nextFiber.sibling;
    }
    nextFiber = nextFiber.parent;
  };
}

// 第二版的 performUnitOfWork function, 已經能夠使用了
// 但這裡只有實作 create new fiber, 沒有做 diff 演算法去 update or delete
function performUnitOfWork2(fiber) {
  console.log('performUnitOfWork', '\r\n');
  // add dom node
  if (!fiber.dom) {
    fiber.dom = createDom(fiber);
  }

  // create new fibers from elements that was created by createElement
  const elements = fiber.props.children;
  let index = 0, prevSibling = null;
  while (index < elements.length) {
    const element = elements[index];
    const newFiber = {
      type: element.type,
      props: element.props,
      parent: fiber, // current fiber as parent
      dom: null,
    }
    // 第一個 newFiber 作為 child
    if (index === 0) {
      fiber.child = newFiber;
    } else {
      // 後續同階級的 newFiber, 作為前一個 fiber 的 sibling
      prevSibling.sibling = newFiber;
    }
    prevSibling = newFiber;
    index++;
  }
  // first try with the child
  // 當前 fiber child 垂直往下直衝到底
  if (fiber.child) {
    return fiber.child;
  };
  let nextFiber = fiber;
  // then with nextFiber.sibling, until without sibling
  // 此時沒有child, 開始找此 fiber.sibling, 水平直衝到底
  while (nextFiber) {
    if (nextFiber.sibling) {
      return nextFiber.sibling;
    }
    // then for search up with parentFiber.sibling as the uncle.
    // 此時fiber沒有child也沒有sibling(垂直衝到底且水平也衝到底了), 往上找父fiber的sibling, 回到125行(再把父fiber.sibling的水平也衝到底)
    nextFiber = nextFiber.parent;
  };
  // not child && not sibling && not parent, currently at root fiber
  // return undefined as nextUnitOfWork
  // 一直往上找後，直衝到此時 fiber 為 root fiber, 則 return undefined
}