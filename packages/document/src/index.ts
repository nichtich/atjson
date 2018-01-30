import Annotation from './annotation';

const OBJECT_REPLACEMENT = '\uFFFC';

export { Annotation };

export default class AtJSON {

  content: string;
  contentType?: string;
  annotations: Annotation[];

  constructor(options: { content: string, annotations?: Annotation[], contentType?: string } | string) {
    if (typeof options === 'string') {
      options = { content: options };
    }
    this.content = options.content;
    this.annotations = options.annotations || [] as Annotation[];
    this.contentType = options.contentType || 'text/plain';
  }

  addAnnotations(annotations: Annotation | Annotation[]): void {
    this.annotations = this.annotations.concat(annotations);
  }

  removeAnnotation(annotation: Annotation): Annotation | void {
    let index = this.annotations.indexOf(annotation);
    if (index > -1) {
      return this.annotations.splice(index, 1)[0];
    }
  }

  insertText(position: number, text: string, preserveAdjacentBoundaries: boolean = false) {

    if (position < 0 || position > this.content.length) throw new Error('Invalid position.');

    const length = text.length;

    const before = this.content.slice(0, position);
    const after = this.content.slice(position);
    this.content = before + text + after;

    for (let i = this.annotations.length - 1; i >= 0; i--) {
      let a = this.annotations[i];

      // annotation types that implement the Annotation transform interface can
      // override the default behaviour. This is desirable for e.g., links or
      // comments, where insertion at the end of the link/comment should _not_
      // affect the annotation.
      //
      // FIXME this whole inner loop should probably be moved to a base Annotation.transform
      if (a.transform) {
        a.transform(a, this.content, position, text.length, preserveAdjacentBoundaries);

      // The first two normal cases are self explanatory. Just adjust the annotation
      // position, since there is never a case where we wouldn't want to.
      } else if (position < a.start) {
        a.start += length;
        a.end += length;
      } else if (position > a.start && position < a.end) {
        a.end += length;

      // In this case, however, the normal behaviour when inserting text at a
      // point adjacent to an annotation is to drag along the end of the
      // annotation, or push forward the beginning, i.e., the transform happens
      // _inside_ an annotation to the left, or _outside_ an annotation to the right.
      //
      // Sometimes, the desire is to change the direction; this is provided below
      // with the preserveAdjacentBoundaries switch.

      // Default edge behaviour.
      } else if (!preserveAdjacentBoundaries) {
        if (position === a.start) {
          a.start += length;
          a.end += length;
        } else if (position === a.end) {
          a.end += length;
        }

      // Non-standard behaviour. Do nothing to the adjacent boundary!
      } else if (position === a.start) {
        a.end += length;

      // no-op; we would delete the annotation, but we should defer to the
      // annotation as to whether or not it's deletable, since some zero-length
      // annotations should be retained.
      // n.b. the += 0 is just to silence tslint ;-)
      } else if (position === a.end)  {
        a.end += 0;
      }
    }
  }

  deleteText(annotation: Annotation) {
    // This should really not just truncate annotations, but rather tombstone
    // the modified annotations as an atjson sub-document inside the annotation
    // that's being used to delete stuff.

    const start = annotation.start;
    const end = annotation.end;
    const length = end - start;

    if (!(start >= 0 && end >= 0)) {
      throw new Error('Start and end must be numbers.');
    }

    const before = this.content.slice(0, start);
    const after = this.content.slice(end);

    this.content = before + after;

    for (let i = this.annotations.length - 1; i >= 0; i--) {
      let a = this.annotations[i];

      // We're deleting after the annotation, nothing needed to be done.
      //    [   ]
      // -----------*---*---
      if (a.end < start) continue;

      // If the annotation is wholly *after* the deleted text, just move
      // everything.
      //           [       ]
      // --*---*-------------
      if (end < a.start) {
        a.start -= length;
        a.end -= length;

      } else {

        if (end < a.end) {

          // Annotation spans the whole deleted text, so just truncate the end of
          // the annotation (shrink from the right).
          //   [             ]
          // ------*------*---------
          if (start > a.start) {
            a.end -= length;

          // Annotation occurs within the deleted text, affecting both start and
          // end of the annotation, but by only part of the deleted text length.
          //         [         ]
          // ---*---------*------------
          } else if (start <= a.start) {
            a.start -= a.start - start;
            a.end -= length;
          }

        } else if (end >= a.end) {

          //             [  ]
          //          [     ]
          //          [         ]
          //              [     ]
          //    ------*---------*--------
          if (start <= a.start) {
            a.start = start;
            a.end = start;

          //       [        ]
          //    ------*---------*--------
          } else if (start > a.start) {
            a.end = start;
          }

        }
      }
    }
  }

  /**
    Replace parse tokens with object replacement characters.
   */
  objectReplacementSubstitution(annotation: Annotation): void {
    const start = annotation.start;
    const end = annotation.end;
    const delta = end - start - 1;
    const before = this.content.slice(0, start);
    const after = this.content.slice(end);
    this.content = before + OBJECT_REPLACEMENT + after;

    for (let i = this.annotations.length - 1; i >= 0; i--) {
      let a = this.annotations[i];
      if (a === annotation) {
        a.end = a.start + 1;
      } else {
        if (a.start >= end) {
          a.start -= delta;
        }
        if (a.end >= end) {
          a.end -= delta;
        }
      }
    }
  }
}
