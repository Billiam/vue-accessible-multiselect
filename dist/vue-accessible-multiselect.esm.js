// Key code constants
var KEY_END = 35;
var KEY_HOME = 36;
var KEY_LEFT = 37;
var KEY_UP = 38;
var KEY_RIGHT = 39;
var KEY_DOWN = 40;
var KEY_A = 65;

var config = {
  transition: null
};

const ARROWS = [KEY_LEFT, KEY_UP, KEY_RIGHT, KEY_DOWN];

const TYPE_AHEAD_TIMEOUT = 500;

const options = val => {
  if (Array.isArray(val)) {
    for (let i = 0; i < val.length; i++) {
      const option = val[i];

      if (typeof option === 'object' && option !== null) {
        if ('value' in option && 'label' in option) {
          continue
        } else {
          return false
        }
      } else {
        return false
      }
    }

    return true
  } else {
    return false
  }
};

const transition = val => {
  return val === null || (typeof val === 'object' && 'name' in val)
};

function getItemsByRange(array, from, to) {
  if (to < from) {
    to = [from, (from = to)][0];
  }

  return array.slice(from, to + 1)
}

//

var script = {
  name: 'VueAccessibleMultiselect',
  props: {
    options: {
      type: Array,
      required: true,
      validator: options,
    },
    value: {
      required: true
    },
    transition: {
      type: Object,
      default: () => config.transition || null,
      validator: transition,
    },
    label: String,
    placeholder: String,
    disabled: Boolean,
    multiple: {
      type: Boolean,
      default: true
    },
    closeOnSelect: {
      type: Boolean,
      default: false
    }
  },
  data() {
    const { _uid } = this;

    return {
      open: false,
      timeout: null,
      printedText: '',
      localId_: _uid,
      activeDescendantIndex: -1,
    }
  },
  computed: {
    className() {
      return { 'v-multiselect--opened': this.open }
    },
    labelId() {
      return this.label || this.hasSlot('label')
        ? `v-multiselect-label-${this.localId_}`
        : null
    },
    buttonId() {
      return `v-multiselect-button-${this.localId_}`
    },
    ariaExpanded() {
      return this.open ? 'true' : false
    },
    btnClass() {
      return {
        'v-multiselect__btn--disabled': this.disabled,
      }
    },
    isPlaceholderVisible() {
      return (
        (this.placeholder ||
        this.hasSlot('placeholder')) &&
          (!this.value || (Array.isArray(this.value) && this.value.length === 0))
      )
    },
    isSelectedTextVisible () {
      if (this.multiple) {
        return Array.isArray(this.value) && this.value.length !== 0
      } else {
        return this.value != undefined
      }
    },
    selectedText() {
      if (this.multiple) {
        if (Array.isArray(this.value)) {
          return this.value
            .map(value => {
              const option = this.options.find(option => option.value === value);
              return (option && option.label) ? option.label : ''
            })
            .join(', ')
        }
      } else {
        const option = this.options.find(option => option.value === this.value);
        return (option && option.label) ? option.label : ''
      }
    },
  },
  watch: {
    open(val) {
      if (val) {
        this.$nextTick(() => {
          document.addEventListener('click', this.clickListener);

          this.$refs.list.focus();
          // if there are selected options, then set focus to the first
          if (this.value.length) {
            // if there ar options provided
            if (this.$refs.options) {
              const firstSelectedOptionIndex = this.$refs.options.findIndex(
                option =>
                  option.classList.contains('v-multiselect__option--selected')
              );

              this.activeDescendantIndex = firstSelectedOptionIndex;
            }
          } else {
            // if not select to the first option
            this.activeDescendantIndex = 0;
          }

          this.$emit('open');
        });
      } else {
        document.removeEventListener('click', this.clickListener);
        this.$emit('close');
      }
    },
    activeDescendantIndex() {
      this.scrollToActiveDescendant();
    },
  },
  /*
   * SSR Safe Client Side ID attribute generation
   * id's can only be generated client side, after mount.
   * this._uid is not synched between server and client.
   */
  mounted() {
    this.$nextTick(() => {
      // Update DOM with auto ID after DOM loaded to prevent
      // SSR hydration errors.
      this.localId_ = this._uid;
    });
  },
  methods: {
    toggle() {
      this.open = !this.open;
    },
    clickListener(e) {
      const { target } = e;
      const { list, button } = this.$refs;
      if ((list && list.contains(target)) || button.contains(target)) ; else {
        this.open = false;
      }
    },
    isSelected(option) {
      if (this.multiple) {
        if (Array.isArray(this.value)) {
          return this.value.includes(option.value)
        } else {
          return false
        }
      } else {
        return this.value === option.value
      }
    },
    input(option) {
      let value = this.value;

      const { value: optionValue } = option;

      if (this.multiple) {
        if (!Array.isArray(value)) value = [];

        if (value.includes(optionValue)) {
          value.splice(value.indexOf(optionValue), 1);
        } else {
          value.push(optionValue);
        }
      } else {
        value = optionValue;
      }

      this.$emit('input', value);

      if (this.closeOnSelect) {
        this.open = false;
      }
    },
    directionHandler(e, direction) {
      const { activeDescendantIndex } = this;

      switch (direction) {
        case 'up':
          if (this.activeDescendantIndex !== 0) {
            this.activeDescendantIndex--;
          }
          break
        case 'down':
          if (this.activeDescendantIndex !== this.options.length - 1) {
            this.activeDescendantIndex++;
          }
          break
      }

      if (e.shiftKey && activeDescendantIndex !== this.activeDescendantIndex) {
        this.input(this.options[this.activeDescendantIndex]);
      }
    },
    getOptionId(option) {
      return `v-multiselect-option-${this.options.indexOf(option)}_${
        this.localId_
      }`
    },
    getOptionClass(option) {
      return `v-multiselect-option-value-${option.value.replace(/\s+/g, '-')}`
    },
    escapeHandler() {
      this.open = false;
      this.$refs.button.focus();
    },
    printHandler(e) {
      const keyCode = e.keyCode || e._keyCode;

      this.printedText += String.fromCharCode(keyCode);

      this.selectByText(this.printedText);

      clearTimeout(this.timeout);

      this.timeout = setTimeout(() => {
        this.printedText = '';
      }, TYPE_AHEAD_TIMEOUT);
    },
    selectByText(text) {
      for (const index of this.options.keys()) {
        if (this.options[index].label.toUpperCase().startsWith(text)) {
          this.activeDescendantIndex = index;
          return
        }
      }
    },
    /**
     * prevents default scrolling
     */
    keyDownHandler(e) {
      const keyCode = e.keyCode || e._keyCode;

      if (ARROWS.indexOf(keyCode) !== -1) {
        e.preventDefault();
      }
    },
    /* istanbul ignore next */
    scrollToActiveDescendant() {
      // get current option DOM node
      const { options } = this.$refs;

      if (options) {
        const currentOption = options[this.activeDescendantIndex];

        if (currentOption) {
          const { offsetTop, clientHeight } = currentOption;

          const { list } = this.$refs;

          const currentVisibleArea = list.scrollTop + list.clientHeight;

          if (offsetTop < list.scrollTop) {
            list.scrollTop = offsetTop;
          } else if (offsetTop + clientHeight > currentVisibleArea) {
            list.scrollTop = offsetTop - list.clientHeight + clientHeight;
          }
        }
      }
    },
    spaceHandler(event) {
      // if shift is pressed then select all options contiguous options
      // from the most recently selected item to the focused item

      if (this.multiple && event.shiftKey) {
        const lastSelectedOptionIndex = this.getLastSelectedOptionIndex();

        if (lastSelectedOptionIndex !== -1) {
          // get items between current focused item and last selected item
          let options = getItemsByRange(
            this.options,
            lastSelectedOptionIndex,
            this.activeDescendantIndex
          );

          // exclude currently selected option
          if (options.length !== 1) {
            if (lastSelectedOptionIndex > this.activeDescendantIndex) {
              options.pop();
            } else {
              options.shift();
            }
          }
          // get only values and then filter that already selected
          options = options
            .map(option => option.value)
            .filter(option => !this.value.includes(option));

          this.$emit('input', this.value.concat(options));
        } else {
          this.input(this.options[this.activeDescendantIndex]);
        }
      } else {
        this.input(this.options[this.activeDescendantIndex]);
      }
    },
    selectAllToEdge(edge) {
      const array = this.value.splice(0);

      const { options } = this;

      switch (edge) {
        case 'start':
          for (let i = this.activeDescendantIndex; i >= 0; i--) {
            const { value } = options[i];

            if (!array.includes(value)) {
              array.push(this.options[i].value);
            }
          }
          this.activeDescendantIndex = 0;
          break
        case 'end':
          for (
            let i = this.activeDescendantIndex;
            i <= options.length - 1;
            i++
          ) {
            const { value } = options[i];

            if (!array.includes(value)) {
              array.push(this.options[i].value);
            }
          }
          this.activeDescendantIndex = this.options.length - 1;
          break
      }

      this.$emit('input', array);
    },
    toggleAll() {
      if (this.isAllSelected()) {
        this.unselectAll();
      } else {
        this.selectAll();
      }
    },
    isAllSelected() {
      // if array of selected options has the same length that options
      // then all options are selected
      return this.value.length === this.options.length
    },
    selectAll() {
      const { options } = this;
      const value = options.map(value => value.value);
      this.$emit('input', value);
    },
    unselectAll() {
      this.$emit('input', []);
    },
    getLastSelectedOption() {
      // if no options is selected return undefined
      if (this.value.length === 0) return
      const lastSelectedValue = this.value[this.value.length - 1];
      return this.options.find(option => option.value === lastSelectedValue)
    },
    getLastSelectedOptionIndex() {
      return this.options.indexOf(this.getLastSelectedOption())
    },
    homeAndEndHandler(e) {
      if (e.shiftKey) return

      switch (e.keyCode) {
        case KEY_END:
          // set focus to the last item
          this.activeDescendantIndex = this.options.length - 1;
          break
        case KEY_HOME:
          // set focus to the first item
          this.activeDescendantIndex = 0;
          break
      }
    },
    blurHandler(e) {
      // if next focus target not equals to the button element
      // then close the list
      if (e.relatedTarget !== this.$refs.button) {
        this.open = false;
      }
    },
    hasSlot(name) {
      return Boolean(this.$slots[name]) || Boolean(this.$scopedSlots[name])
    },
    keyUpHandler(e) {
      if (this.multiple) {
        const keyCode = e.keyCode || e._keyCode;

        if (e.ctrlKey && keyCode === KEY_A) {
          this.toggleAll();
          return
        }

        if (e.ctrlKey && e.shiftKey) {
          if (keyCode === KEY_END) {
            this.selectAllToEdge('end');
            return
          }

          if (keyCode === KEY_HOME) {
            this.selectAllToEdge('start');
            return
          }
        }
      }

      this.printHandler(e);
    },
  },
};

function normalizeComponent(template, style, script, scopeId, isFunctionalTemplate, moduleIdentifier /* server only */, shadowMode, createInjector, createInjectorSSR, createInjectorShadow) {
    if (typeof shadowMode !== 'boolean') {
        createInjectorSSR = createInjector;
        createInjector = shadowMode;
        shadowMode = false;
    }
    // Vue.extend constructor export interop.
    const options = typeof script === 'function' ? script.options : script;
    // render functions
    if (template && template.render) {
        options.render = template.render;
        options.staticRenderFns = template.staticRenderFns;
        options._compiled = true;
        // functional template
        if (isFunctionalTemplate) {
            options.functional = true;
        }
    }
    // scopedId
    if (scopeId) {
        options._scopeId = scopeId;
    }
    let hook;
    if (moduleIdentifier) {
        // server build
        hook = function (context) {
            // 2.3 injection
            context =
                context || // cached call
                    (this.$vnode && this.$vnode.ssrContext) || // stateful
                    (this.parent && this.parent.$vnode && this.parent.$vnode.ssrContext); // functional
            // 2.2 with runInNewContext: true
            if (!context && typeof __VUE_SSR_CONTEXT__ !== 'undefined') {
                context = __VUE_SSR_CONTEXT__;
            }
            // inject component styles
            if (style) {
                style.call(this, createInjectorSSR(context));
            }
            // register component module identifier for async chunk inference
            if (context && context._registeredComponents) {
                context._registeredComponents.add(moduleIdentifier);
            }
        };
        // used by ssr in case component is cached and beforeCreate
        // never gets called
        options._ssrRegister = hook;
    }
    else if (style) {
        hook = shadowMode
            ? function (context) {
                style.call(this, createInjectorShadow(context, this.$root.$options.shadowRoot));
            }
            : function (context) {
                style.call(this, createInjector(context));
            };
    }
    if (hook) {
        if (options.functional) {
            // register for functional component in vue file
            const originalRender = options.render;
            options.render = function renderWithStyleInjection(h, context) {
                hook.call(context);
                return originalRender(h, context);
            };
        }
        else {
            // inject component registration as beforeCreate hook
            const existing = options.beforeCreate;
            options.beforeCreate = existing ? [].concat(existing, hook) : [hook];
        }
    }
    return script;
}

/* script */
const __vue_script__ = script;

/* template */
var __vue_render__ = function() {
  var _vm = this;
  var _h = _vm.$createElement;
  var _c = _vm._self._c || _h;
  return _c("div", { staticClass: "v-multiselect", class: _vm.className }, [
    _vm.hasSlot("label") || _vm.label
      ? _c(
          "span",
          { staticClass: "v-multiselect__label", attrs: { id: _vm.labelId } },
          [_vm._t("label", [_vm._v(_vm._s(_vm.label) + ":")])],
          2
        )
      : _vm._e(),
    _c(
      "div",
      { staticClass: "v-multiselect__inner" },
      [
        _c(
          "button",
          {
            ref: "button",
            staticClass: "v-multiselect__btn",
            class: _vm.btnClass,
            attrs: {
              id: _vm.buttonId,
              disabled: _vm.disabled,
              "aria-expanded": _vm.ariaExpanded,
              "aria-labelledby":
                (_vm.labelId ? _vm.labelId : "") + " " + _vm.buttonId,
              type: "button",
              "aria-haspopup": "listbox"
            },
            on: { click: _vm.toggle }
          },
          [
            _vm.hasSlot("prepend")
              ? _c(
                  "span",
                  { staticClass: "v-multiselect__prepend" },
                  [_vm._t("prepend")],
                  2
                )
              : _vm._e(),
            _vm.isPlaceholderVisible
              ? _c(
                  "span",
                  { staticClass: "v-multiselect__placeholder" },
                  [
                    _vm._t("placeholder", [_vm._v(_vm._s(_vm.placeholder))], {
                      placeholder: _vm.placeholder
                    })
                  ],
                  2
                )
              : _vm._e(),
            _vm.isSelectedTextVisible
              ? _c(
                  "span",
                  { staticClass: "v-multiselect__selected" },
                  [
                    _vm._t("selected", [_vm._v(_vm._s(_vm.selectedText))], {
                      value: _vm.value,
                      options: _vm.options
                    })
                  ],
                  2
                )
              : _vm._e(),
            _c(
              "span",
              { staticClass: "v-multiselect__arrow" },
              [
                _vm._t("arrow", [
                  _c("svg", { attrs: { viewBox: "0 0 255 255" } }, [
                    _c("path", { attrs: { d: "M0 64l128 127L255 64z" } })
                  ])
                ])
              ],
              2
            )
          ]
        ),
        _c(
          "transition",
          {
            attrs: {
              name: _vm.transition ? _vm.transition.name : "",
              mode: _vm.transition ? _vm.transition.mode : ""
            }
          },
          [
            _vm.open
              ? _c("div", { staticClass: "v-multiselect__menu" }, [
                  Array.isArray(_vm.options) && _vm.options.length
                    ? _c(
                        "ul",
                        {
                          ref: "list",
                          staticClass: "v-multiselect__list",
                          staticStyle: { position: "relative" },
                          attrs: {
                            "aria-multiselectable": "true",
                            "aria-activedescendant": _vm.getOptionId(
                              _vm.options[_vm.activeDescendantIndex]
                            ),
                            "aria-labelledby": _vm.labelId,
                            role: "listbox",
                            tabindex: "-1"
                          },
                          on: {
                            keydown: [
                              _vm.keyDownHandler,
                              function($event) {
                                if (
                                  !$event.type.indexOf("key") &&
                                  _vm._k(
                                    $event.keyCode,
                                    "space",
                                    32,
                                    $event.key,
                                    [" ", "Spacebar"]
                                  )
                                ) {
                                  return null
                                }
                                return $event.preventDefault()
                              },
                              function($event) {
                                if (
                                  !$event.type.indexOf("key") &&
                                  _vm._k(
                                    $event.keyCode,
                                    "esc",
                                    27,
                                    $event.key,
                                    ["Esc", "Escape"]
                                  )
                                ) {
                                  return null
                                }
                                $event.stopPropagation();
                                return _vm.escapeHandler($event)
                              },
                              function($event) {
                                if (
                                  !$event.type.indexOf("key") &&
                                  _vm._k(
                                    $event.keyCode,
                                    "enter",
                                    13,
                                    $event.key,
                                    "Enter"
                                  )
                                ) {
                                  return null
                                }
                                return _vm.spaceHandler($event)
                              }
                            ],
                            keyup: [
                              _vm.keyUpHandler,
                              function($event) {
                                if (
                                  !$event.type.indexOf("key") &&
                                  _vm._k($event.keyCode, "up", 38, $event.key, [
                                    "Up",
                                    "ArrowUp"
                                  ])
                                ) {
                                  return null
                                }
                                return _vm.directionHandler($event, "up")
                              },
                              function($event) {
                                if (
                                  !$event.type.indexOf("key") &&
                                  _vm._k(
                                    $event.keyCode,
                                    "down",
                                    40,
                                    $event.key,
                                    ["Down", "ArrowDown"]
                                  )
                                ) {
                                  return null
                                }
                                return _vm.directionHandler($event, "down")
                              },
                              function($event) {
                                if (
                                  !$event.type.indexOf("key") &&
                                  _vm._k(
                                    $event.keyCode,
                                    "space",
                                    32,
                                    $event.key,
                                    [" ", "Spacebar"]
                                  )
                                ) {
                                  return null
                                }
                                return _vm.spaceHandler($event)
                              },
                              function($event) {
                                if (
                                  !$event.type.indexOf("key") &&
                                  _vm._k(
                                    $event.keyCode,
                                    "home",
                                    undefined,
                                    $event.key,
                                    undefined
                                  )
                                ) {
                                  return null
                                }
                                return _vm.homeAndEndHandler($event)
                              },
                              function($event) {
                                if (
                                  !$event.type.indexOf("key") &&
                                  _vm._k(
                                    $event.keyCode,
                                    "end",
                                    undefined,
                                    $event.key,
                                    undefined
                                  )
                                ) {
                                  return null
                                }
                                return _vm.homeAndEndHandler($event)
                              }
                            ],
                            blur: _vm.blurHandler
                          }
                        },
                        _vm._l(_vm.options, function(option, index) {
                          return _c(
                            "li",
                            {
                              key: index,
                              ref: "options",
                              refInFor: true,
                              staticClass: "v-multiselect__option",
                              class: [
                                _vm.getOptionClass(option),
                                {
                                  "v-multiselect__option--selected": _vm.isSelected(
                                    option
                                  ),
                                  "v-multiselect__option--focus":
                                    index === _vm.activeDescendantIndex
                                }
                              ],
                              attrs: {
                                id: _vm.getOptionId(option),
                                role: "option",
                                "aria-selected": _vm.isSelected(option)
                                  ? "true"
                                  : "false"
                              },
                              on: {
                                click: function($event) {
                                  return _vm.input(option)
                                }
                              }
                            },
                            [
                              _vm._t("option", [_vm._v(_vm._s(option.label))], {
                                option: option,
                                value: _vm.value
                              })
                            ],
                            2
                          )
                        }),
                        0
                      )
                    : _c(
                        "div",
                        { staticClass: "v-multiselect__no-options" },
                        [
                          _vm._t("no-options", [
                            _c("span", [_vm._v("No options provided")])
                          ])
                        ],
                        2
                      )
                ])
              : _vm._e()
          ]
        )
      ],
      1
    )
  ])
};
var __vue_staticRenderFns__ = [];
__vue_render__._withStripped = true;

  /* style */
  const __vue_inject_styles__ = undefined;
  /* scoped */
  const __vue_scope_id__ = undefined;
  /* module identifier */
  const __vue_module_identifier__ = undefined;
  /* functional template */
  const __vue_is_functional_template__ = false;
  /* style inject */
  
  /* style inject SSR */
  
  /* style inject shadow dom */
  

  
  const __vue_component__ = /*#__PURE__*/normalizeComponent(
    { render: __vue_render__, staticRenderFns: __vue_staticRenderFns__ },
    __vue_inject_styles__,
    __vue_script__,
    __vue_scope_id__,
    __vue_is_functional_template__,
    __vue_module_identifier__,
    false,
    undefined,
    undefined,
    undefined
  );

const Plugin = {
  install(Vue) {
    // Make sure that plugin can be installed only once
    if (this.installed) {
      return
    }

    this.installed = true;

    Vue.component('VueAccessibleMultiselect', __vue_component__);
  },
};

export default Plugin;
export { __vue_component__ as VueAccessibleMultiselect, config };
