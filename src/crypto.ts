import BN from "bn.js";
import * as encUtils from "enc-utils";
import hashJS from "hash.js";
import { Signer } from "@ethersproject/abstract-signer";

type SignatureOptions = {
  r: BN;
  s: BN;
  recoveryParam: number | null | undefined;
};

const order = new BN("08000000 00000010 ffffffff ffffffff b781126d cae7b232 1e66a241 adc64d2f", 16);

const secpOrder = new BN("FFFFFFFF FFFFFFFF FFFFFFFF FFFFFFFE BAAEDCE6 AF48A03B BFD25E8C D0364141", 16);

const hashKeyWithIndex = (key: string, index: number): BN => {
  return new BN(
    hashJS
      .sha256()
      .update(
        encUtils.hexToBuffer(encUtils.removeHexPrefix(key) + encUtils.sanitizeBytes(encUtils.numberToHex(index), 2))
      )
      .digest("hex"),
    16
  );
};

const grindKey = (privateKey: string): string => {
  let i = 0;
  let key: BN = hashKeyWithIndex(privateKey, i);

  while (!key.lt(secpOrder.sub(secpOrder.mod(order)))) {
    key = hashKeyWithIndex(key.toString(16), i);
    i = i++;
  }
  return key.mod(order).toString("hex");
};

// used to sign message with L1 keys. Used for registration
const serializeEthSignature = (sig: SignatureOptions): string => {
  // This is because golang appends a recovery param
  // https://github.com/ethers-io/ethers.js/issues/823
  return encUtils.addHexPrefix(
    encUtils.padLeft(sig.r.toString(16), 64) +
      encUtils.padLeft(sig.s.toString(16), 64) +
      encUtils.padLeft(sig.recoveryParam?.toString(16) || "", 2)
  );
};

const importRecoveryParam = (v: string): number | undefined => {
  return v.trim()
    ? new BN(v, 16).cmp(new BN(27)) !== -1
      ? new BN(v, 16).sub(new BN(27)).toNumber()
      : new BN(v, 16).toNumber()
    : undefined;
};

// used chained with serializeEthSignature. serializeEthSignature(deserializeSignature(...))
const deserializeSignature = (sig: string, size = 64): SignatureOptions => {
  sig = encUtils.removeHexPrefix(sig);
  return {
    r: new BN(sig.substring(0, size), "hex"),
    s: new BN(sig.substring(size, size * 2), "hex"),
    recoveryParam: importRecoveryParam(sig.substring(size * 2, size * 2 + 2)),
  };
};

const signRaw = async (payload: string, signer: Signer): Promise<string> => {
  const signature = deserializeSignature(await signer.signMessage(payload));
  return serializeEthSignature(signature);
};

const signMessage = async (
  message: string,
  signer: Signer
): Promise<{ message: string; ethAddress: string; ethSignature: string }> => {
  const ethAddress = await signer.getAddress();
  const ethSignature = await signRaw(message, signer);
  return {
    message,
    ethAddress,
    ethSignature,
  };
};

export { grindKey, signRaw, signMessage };
