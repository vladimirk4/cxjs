import {Widget, VDOM} from '../ui/Widget';
import {PureContainer} from '../ui/PureContainer';
import {tooltipMouseMove, tooltipParentWillUnmount, tooltipMouseLeave, tooltipParentWillReceiveProps, tooltipParentDidMount} from './overlay/tooltip-ops';
import {Url} from '../ui/app/Url';
import {parseStyle} from '../util/parseStyle';
import {debug} from '../util/Debug';
import {isString} from '../util/isString';
import {isUndefined} from '../util/isUndefined';
import {isDefined} from '../util/isDefined';
import {isArray} from '../util/isArray';

var isDataAttribute = attr => attr.indexOf('data-') == 0 ? attr.substring(5) : false;

export var urlAttributes = {
   'a.href': true,
   'img.src': true
};

export class HtmlElement extends PureContainer {

   constructor(config) {
      super(config);

      if (isUndefined(this.jsxAttributes) && config)
         this.jsxAttributes = Object.keys(config).filter(::this.isValidHtmlAttribute);
   }

   init() {
      if (this.innerText)
         this.text = this.innerText;

      if (this.html)
         this.innerHtml = this.html;
   }

   declareData() {

      var data = {
         text: undefined,
         innerHtml: undefined,
         attrs: {
            structured: true
         },
         data: {
            structured: true
         }
      };

      var name;

      this.urlAttributes = [];

      if (this.jsxAttributes) {
         this.jsxAttributes.forEach(attr => {

            if (urlAttributes[`${this.tag}.${attr}`])
               this.urlAttributes.push(attr);

            if ((name = isDataAttribute(attr))) {
               if (!this.data)
                  this.data = {};
               this.data[name] = this[attr];
            }
            else if ((name = this.isValidHtmlAttribute(attr)) && !data.hasOwnProperty(name)) {
               if (name.indexOf('on') == 0) {
                  if (!this.events)
                     this.events = {};
                  this.events[name] = this[attr];
               } else {
                  if (!this.attrs)
                     this.attrs = {};
                  this.attrs[name] = this[attr];
               }
            }
         });
      }

      if (this.urlAttributes.length == 0)
         delete this.urlAttributes;

      super.declareData(...arguments, data);
   }

   isValidHtmlAttribute(attrName) {
      switch (attrName) {
         case 'tag':
         case "type":
         case "$type":
         case "$props":
         case "text":
         case 'layout':
         case 'class':
         case 'className':
         case 'style':
         case 'controller':
         case 'outerLayout':
         case 'items':
         case 'children':
         case 'visible':
         case 'if':
         case 'mod':
         case 'putInto':
         case 'contentFor':
         case 'trimWhitespace':
         case 'preserveWhitespace':
         case 'ws':
         case 'plainText':
         case 'vertical':
         case 'memoize':
         case "onInit":
         case "onExplore":
         case "html":
         case "innerText":
         case "baseClass":
         case "CSS":
         case "tooltip":
         case "styles":
            return false;

         default:
            if (isDataAttribute(attrName))
               return false;

            break;
      }

      return attrName;
   }
   
   init() {

      if (this.html)
         this.innerHtml = this.html;
         
      if (this.innerText)
         this.text = this.innerText;         

      this.style = parseStyle(this.style);
      super.init();
   }

   prepareData(context, instance) {
      var {data} = instance;
      if (this.urlAttributes && data.attrs)
         this.urlAttributes.forEach(attr=> {
            if (isString(data.attrs[attr]))
               data.attrs[attr] = Url.resolve(data.attrs[attr]);
         });
      super.prepareData(context, instance);
   }

   attachProps(context, instance, props) {
      Object.assign(props, this.extraProps);
   }

   render(context, instance, key) {

      //rebind events to pass instance
      if (this.events && !instance.events) {
         instance.events = {};
         for (let eventName in this.events) {
            instance.events[eventName] = e => instance.invoke(eventName, e, instance);
         }
      }

      let {data, events, shouldUpdate} = instance;

      let props = Object.assign({
         key: key,
         className: data.classNames,
         style: data.style
      }, data.attrs, events);

      let children;
      if (isDefined(data.text))
         children = data.text;
      else if (isString(data.innerHtml)) {
         props.dangerouslySetInnerHTML = {__html: data.innerHtml};
      }
      else {
         children = this.renderChildren(context, instance);
         if (children && isArray(children) && children.length == 0)
            children = undefined;
      }

      props.children = children;

      this.attachProps(context, instance, props);

      if (this.memoize || this.tooltip)
         return (
            <ContainerComponent
               key={key}
               tag={this.tag}
               props={props}
               instance={instance}
               data={data}
               shouldUpdate={shouldUpdate}
            >
               {props.children}
            </ContainerComponent>
         );

      return VDOM.createElement(this.tag, props, props.children);
   }
}

HtmlElement.prototype.tag = 'div';
HtmlElement.prototype.styled = true;

class ContainerComponent extends VDOM.Component {

   shouldComponentUpdate(props) {
      return props.shouldUpdate;
   }

   render() {
      var {tag, props, children, instance} = this.props;

      if (instance.widget.tooltip) {
         props.ref = c => {
            this.el = c
         };

         var {onMouseLeave, onMouseMove} = props;

         props.onMouseLeave = (e) => {
            tooltipMouseLeave(e, instance, instance.widget.tooltip);
            if (onMouseLeave) onMouseLeave(e);
         };
         props.onMouseMove = (e) => {
            tooltipMouseMove(e, instance, instance.widget.tooltip);
            if (onMouseMove) onMouseMove(e);
         }
      }

      return VDOM.createElement(tag, props, children);
   }

   componentWillUnmount() {
      tooltipParentWillUnmount(this.props.instance);
   }

   componentWillReceiveProps(props) {
      tooltipParentWillReceiveProps(this.el, props.instance, this.props.instance.widget.tooltip);
   }
   componentDidMount() {
      tooltipParentDidMount(this.el, this.props.instance, this.props.instance.widget.tooltip);
   }
}

var originalWidgetFactory = Widget.factory;

//support for pure components
Widget.factory = function(type, config, more) {
   var typeType = typeof type;

   if (typeType == 'undefined') {
      debug('Creating a widget of unknown type.', config, more);
      return new HtmlElement(Object.assign({}, config, more));
   }

   if (typeType == 'function')
      return HtmlElement.create(HtmlElement, {tag: type}, config);

   return originalWidgetFactory.call(Widget, type, config, more);
};

Widget.alias('html-element', HtmlElement);