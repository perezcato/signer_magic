import BN from "bn.js";
import * as encUtils from "enc-utils";
import hashJS from "hash.js";
import { ec } from "elliptic";
import { curves, ec as Ec } from "elliptic";
import { splitSignature } from "@ethersproject/bytes";
import { hdkey } from "ethereumjs-wallet";
import { grindKey } from "./crypto";
import { Signer } from "@ethersproject/abstract-signer";

export interface StarkWallet {
  path: string;
  starkPublicKey: string;
  starkKeyPair: ec.KeyPair;
}

const DEFAULT_SIGNATURE_MESSAGE = "Only sign this request if you’ve initiated an action with Immutable X.";

const DEFAULT_ACCOUNT_APPLICATION = "immutablex";
const DEFAULT_ACCOUNT_LAYER = "starkex";
const DEFAULT_ACCOUNT_INDEX = "1";

const prime = new BN("800000000000011000000000000000000000000000000000000000000000001", 16);
const order = new BN("08000000 00000010 ffffffff ffffffff b781126d cae7b232 1e66a241 adc64d2f", 16);

const constantPointsHex = [
  [
    "49ee3eba8c1600700ee1b87eb599f16716b0b1022947733551fde4050ca6804",
    "3ca0cfe4b3bc6ddf346d49d06ea0ed34e621062c0e056c1d0405d266e10268a",
  ],
  [
    "1ef15c18599971b7beced415a40f0c7deacfd9b0d1819e03d723d8bc943cfca",
    "5668060aa49730b7be4801df46ec62de53ecd11abe43a32873000c36e8dc1f",
  ],
];

const getIntFromBits = (hex: string, start: number, end: number | undefined = undefined): number => {
  const bin = encUtils.hexToBinary(hex);
  const bits = bin.slice(start, end);
  const int = encUtils.binaryToNumber(bits);
  return int;
};

const fixMessage = (msg: string) => {
  msg = encUtils.removeHexPrefix(msg);
  msg = new BN(msg, 16).toString(16);

  if (msg.length <= 62) {
    // In this case, msg should not be transformed, as the byteLength() is at most 31,
    // so delta < 0 (see _truncateToN).
    return msg;
  }
  if (msg.length !== 63) {
    throw new Error("StarkCurveInvalidMessageLength");
  }
  // In this case delta will be 4 so we perform a shift-left of 4 bits by adding a ZERO_BN.
  return `${msg}0`;
};

const getAccountPath = (layer: string, application: string, ethereumAddress: string, index: string): string => {
  const layerHash = hashJS.sha256().update(layer).digest("hex");
  const applicationHash = hashJS.sha256().update(application).digest("hex");
  const layerInt = getIntFromBits(layerHash, -31);
  const applicationInt = getIntFromBits(applicationHash, -31);
  const ethAddressInt1 = getIntFromBits(ethereumAddress, -31);
  const ethAddressInt2 = getIntFromBits(ethereumAddress, -62, -31);
  return `m/2645'/${layerInt}'/${applicationInt}'/${ethAddressInt1}'/${ethAddressInt2}'/${index}`;
};

const starkEc = new Ec(
  new curves.PresetCurve({
    type: "short",
    prime: null,
    p: prime as any,
    a: "00000000 00000000 00000000 00000000 00000000 00000000 00000000 00000001",
    b: "06f21413 efbe40de 150e596d 72f7a8c5 609ad26c 15c915c1 f4cdfcb9 9cee9e89",
    n: order as any,
    hash: hashJS.sha256,
    gRed: false,
    g: constantPointsHex[1],
  })
);

const getKeyPair = (privateKey: string): ec.KeyPair => {
  return starkEc.keyFromPrivate(privateKey, "hex");
};

const getKeyPairFromPath = (seed: string, path: string): ec.KeyPair => {
  const privateKey = hdkey
    .fromMasterSeed(Buffer.from(seed.slice(2), "hex")) // assuming seed is '0x...'
    .derivePath(path)
    .getWallet()
    .getPrivateKeyString();
  return getKeyPair(grindKey(privateKey));
};

const getPublic = (keyPair: ec.KeyPair, compressed = false): string => {
  return keyPair.getPublic(compressed, "hex");
};

const getXCoordinate = (publicKey: string): string => {
  const keyPair = starkEc.keyFromPublic(encUtils.hexToArray(publicKey));
  return encUtils.sanitizeBytes((keyPair as any).pub.getX().toString(16), 2);
};

const getStarkPublicKey = (keyPair: ec.KeyPair): string => {
  return encUtils.sanitizeHex(getXCoordinate(getPublic(keyPair, true)));
};

const generateStarkWalletFromSignedMessage = async (ethAddress: string, signature: string): Promise<StarkWallet> => {
  const path = getAccountPath(DEFAULT_ACCOUNT_LAYER, DEFAULT_ACCOUNT_APPLICATION, ethAddress, DEFAULT_ACCOUNT_INDEX);
  const keyPair = getKeyPairFromPath(splitSignature(signature).s, path);
  const starkPublicKey = getStarkPublicKey(keyPair);
  return {
    path,
    starkPublicKey,
    starkKeyPair: keyPair,
  };
};

const generateStarkWallet = async (signer: Signer): Promise<StarkWallet> => {
  const ethAddress = (await signer.getAddress()).toLowerCase();
  const signature = await signer.signMessage(DEFAULT_SIGNATURE_MESSAGE);
  return generateStarkWalletFromSignedMessage(ethAddress, signature);
};

export {
  getIntFromBits,
  fixMessage,
  getAccountPath,
  getKeyPair,
  getKeyPairFromPath,
  getPublic,
  getXCoordinate,
  getStarkPublicKey,
  generateStarkWalletFromSignedMessage,
  generateStarkWallet,
};
