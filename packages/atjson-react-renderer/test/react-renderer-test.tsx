import ReactRenderer from 'atjson-react-renderer';
import { AtJSON, Annotation } from 'atjson';
import { HIR } from 'atjson-hir';
import React from 'react';
import ReactDOM from 'react-dom';
import ReactDOMServer from 'react-dom/server';

function renderDocument(renderer, doc) {
  let element = document.createElement('div');
  let root = document.querySelector('#atjson');
  root.appendChild(element);
  ReactDOM.render(renderer.render(new HIR(doc)), element);
  root.appendChild(document.createElement('hr'));

  return ReactDOMServer.renderToStaticMarkup(renderer.render(new HIR(doc)));
}

QUnit.module('ReactRenderer');

QUnit.test('simple components are called', function (assert) {
  let renderer = new ReactRenderer({
    root({ children }) {
      return <article>{children}</article>
    },
    bold({ children }) {
      return <strong>{children}</strong>;
    },
    italic({ children }) {
      return <em>{children}</em>;
    }
  });

  let document = new AtJSON({
    content: 'This is bold and italic text',
    annotations: [{
      type: 'bold', start: 8, end: 12
    }, {
      type: 'italic', start: 17, end: 23
    }]
  });

  assert.equal(renderDocument(renderer, document),
               `<article>This is <strong>bold</strong> and <em>italic</em> text</article>`);
});

(function () {
  let renderer = new ReactRenderer({
    root({ children }) {
      return <article>{children}</article>
    },
    link({ children, href, shouldOpenInNewTab }) {
      if (shouldOpenInNewTab) {
        return <a href={href} target="__blank" rel="noreferrer noopener">{children}</a>;
      }
      return <a href={href}>{children}</a>;
    },
    newline() {
      return <br/>;
    },
    youtube({ children, source, showRelatedVideos, showPlayerControls, showInfo, noCookies }) {
      let videoId = source.match(/[?|&]v=([^&]*)/)[1];
      let domain = noCookies ? 'youtube-nocookie' : 'youtube';
      let queryParams = [];
      if (showRelatedVideos === false) {
        queryParams.push('rel=0');
      }
      if (showPlayerControls === false) {
        queryParams.push('controls=0');
      }
      if (showInfo === false) {
        queryParams.push('showinfo=0');
      }
      let queryString = '';
      if (queryParams.length) {
        queryString = '?' + queryParams.join('&');
      }
      let src = `https://www.${domain}.com/embed/${videoId}${queryString}`;
      return <iframe width="560" height="315" src={src} frameBorder={0} allowFullScreen={true}></iframe>;
    }
  });

  QUnit.test('nested components are rendered correctly', function (assert) {
    let doc = new AtJSON({
      content: 'Good boy\n ',
      annotations: [{
        type: 'link', start: 0, end: 10, attributes: {
          href: 'https://www.youtube.com/watch?v=U8x85EY03vY'
        }
      }, {
        type: 'newline', start: 8, end: 9
      }, {
        type: 'youtube', start: 9, end: 10, attributes: {
          source: 'https://www.youtube.com/watch?v=U8x85EY03vY',
          showPlayerControls: false,
          showRelatedVideos: false,
          showInfo: false,
          noCookies: true
        }
      }]
    });

    assert.equal(renderDocument(renderer, doc),
                 `<article><a href="https://www.youtube.com/watch?v=U8x85EY03vY">Good boy<br/><iframe width="560" height="315" src="https://www.youtube-nocookie.com/embed/U8x85EY03vY?rel=0&amp;controls=0&amp;showinfo=0" frameborder="0" allowfullscreen=""></iframe></a></article>`);
  });

  QUnit.test('attributes can change ', function (assert) {
    let doc = new AtJSON({
      content: 'Goats!\n ',
      annotations: [{
        type: 'link', start: 0, end: 8, attributes: {
          href: 'https://www.youtube.com/watch?v=AWvefaN8USk',
          shouldOpenInNewTab: true
        }
      }, {
        type: 'newline', start: 6, end: 7
      }, {
        type: 'youtube', start: 7, end: 8, attributes: {
          source: 'https://www.youtube.com/watch?v=AWvefaN8USk'
        }
      }]
    });

    assert.equal(renderDocument(renderer, doc),
                 `<article><a href="https://www.youtube.com/watch?v=AWvefaN8USk" target="__blank" rel="noreferrer noopener">Goats!<br/><iframe width="560" height="315" src="https://www.youtube.com/embed/AWvefaN8USk" frameborder="0" allowfullscreen=""></iframe></a></article>`);
  });

}());
