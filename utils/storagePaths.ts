export const storageBucket = 'documents';
export const pathFor = (
  kind: 'master' | 'ai',
  docNumber: number,
  filename: string
) => `${kind}/${docNumber}/${filename}`;
