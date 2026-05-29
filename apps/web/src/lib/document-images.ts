export function isImageDocument(doc: { contentType: string }): boolean {
  return doc.contentType.startsWith('image/');
}
