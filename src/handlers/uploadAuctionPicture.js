import middy from "@middy/core";
import validator from "@middy/validator";
import httpErrorHandler from "@middy/http-error-handler";
import cors from "@middy/http-cors";
import createError from "http-errors";
import { setAuctionPictureUrl } from "../lib/setAuctionPictureUrl";
import { uploadPictureToS3 } from "../lib/uploadPictureToS3";
import { getAuctionById } from "./getAuction";
import uploadAuctionPictureSchema from '../lib/schemas/uploadAuctionPictureSchema';

export async function uploadAuctionPicture(event, context) {
  const { id } = event.pathParameters;
  const { email } = event.requestContext.authorizer;
  const base64Str = event.body;
  const auction = await getAuctionById(id);

  if (!isBase64(base64Str)) {
    throw new createError.Forbidden(`You need to provide a valid base64 string!`);
  }

  // Validate auction ownership
  if (auction.seller !== email) {
    throw new createError.Forbidden(`You are not the seller of this auction!`);
  }

  const base64 = base64Str.replace(/^data:image\/\w+;base64,/, "");
  const buffer = Buffer.from(base64, "base64");
  let updatedAuction;
  try {
    const pictureUrl = await uploadPictureToS3(
      auction.id + ".jpg",
      buffer
    );

    updatedAuction = await setAuctionPictureUrl(id, pictureUrl);
  } catch (error) {
    console.error(error);
    throw new createError.InternalServerError(error);
  }

  return {
    statusCode: 200,
    body: JSON.stringify(updatedAuction),
  };
}

function isBase64(str) {
  return str.length % 4 == 0 && /^[A-Za-z0-9+/]+[=]{0,3}$/.test(str);
}

export const handler = middy(uploadAuctionPicture)
  .use(httpErrorHandler())
  .use(cors())
  .use(
    validator({
      inputSchema: uploadAuctionPictureSchema,
      ajvOptions: { strict: false },
    })
  );
