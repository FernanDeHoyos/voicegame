import {
  DeleteObjectsCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export function createR2Storage({
  accountId,
  accessKeyId,
  secretAccessKey,
  bucket,
}) {
  if (!accountId || !accessKeyId || !secretAccessKey || !bucket) {
    throw new Error(
      "Configura R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY y R2_BUCKET.",
    );
  }

  const client = new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });

  return {
    async createUploadUrl(key) {
      return getSignedUrl(
        client,
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          ContentType: "audio/wav",
        }),
        { expiresIn: 120 },
      );
    },

    async createDownloadUrl(key) {
      return getSignedUrl(
        client,
        new GetObjectCommand({
          Bucket: bucket,
          Key: key,
          ResponseContentType: "audio/wav",
          ResponseContentDisposition: "inline",
        }),
        { expiresIn: 120 },
      );
    },

    async verifyAudio(key) {
      const result = await client.send(
        new HeadObjectCommand({ Bucket: bucket, Key: key }),
      );
      if (
        result.ContentType !== "audio/wav" ||
        !result.ContentLength ||
        result.ContentLength > 8 * 1024 * 1024
      ) {
        throw new Error("El audio subido no es válido o supera el límite.");
      }
    },

    async deleteAudio(key) {
      await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
    },

    async deleteRoomAudio(roomId) {
      let continuationToken;
      do {
        const page = await client.send(
          new ListObjectsV2Command({
            Bucket: bucket,
            Prefix: `${roomId}/`,
            ContinuationToken: continuationToken,
          }),
        );
        const objects = (page.Contents ?? [])
          .filter((object) => object.Key)
          .map(({ Key }) => ({ Key }));
        if (objects.length) {
          await client.send(
            new DeleteObjectsCommand({
              Bucket: bucket,
              Delete: { Objects: objects, Quiet: true },
            }),
          );
        }
        continuationToken = page.IsTruncated
          ? page.NextContinuationToken
          : undefined;
      } while (continuationToken);
    },
  };
}
