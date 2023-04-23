import {
  SmartContract,
  state,
  State,
  method,
  Permissions,
  UInt64,
  PublicKey,
  Signature,
  Experimental,
  VerificationKey,
  Int64,
} from 'snarkyjs';

const tokenSymbol = 'TOKYO';

export class ExampleToken extends SmartContract {
  @state(UInt64) totalAmountInCirculation = State<UInt64>();

  deploy() {
    super.deploy();

    this.account.permissions.set({
      ...Permissions.default(),
      access: Permissions.proofOrSignature(),
    });
  }

  init() {
    super.init();
    this.account.tokenSymbol.set(tokenSymbol);
    this.totalAmountInCirculation.set(UInt64.zero);
  }

  @method tokenDeploy(deployer: PublicKey, verificationKey: VerificationKey) {
    let tokenId = this.token.id;
    let deployUpdate = Experimental.createChildAccountUpdate(
      this.self,
      deployer,
      tokenId
    );
    deployUpdate.account.permissions.set(Permissions.default());
    deployUpdate.account.verificationKey.set(verificationKey);
    deployUpdate.requireSignature();
  }

  @method mint(
    receiverAddress: PublicKey,
    amount: UInt64,
    adminSignature: Signature
  ) {
    let totalAmountInCirculation = this.totalAmountInCirculation.get();
    this.totalAmountInCirculation.assertEquals(totalAmountInCirculation);

    let newTotalAmountInCirculation = totalAmountInCirculation.add(amount);

    adminSignature
      .verify(
        this.address,
        amount.toFields().concat(receiverAddress.toFields())
      )
      .assertTrue();

    this.token.mint({
      address: receiverAddress,
      amount,
    });

    this.totalAmountInCirculation.set(newTotalAmountInCirculation);
  }

  @method sendTokens(
    senderAddress: PublicKey,
    receiverAddress: PublicKey,
    amount: UInt64,
    callback: Experimental.Callback<any>
  ) {
    let senderAccountUpdate = this.approve(callback);
    let negativeAmount = Int64.fromObject(
      senderAccountUpdate.body.balanceChange
    );
    negativeAmount.assertEquals(Int64.from(amount).neg());
    let tokenId = this.token.id;
    senderAccountUpdate.body.tokenId.assertEquals(tokenId);
    senderAccountUpdate.body.publicKey.assertEquals(senderAddress);
    let receiverAccountUpdate = Experimental.createChildAccountUpdate(
      this.self,
      receiverAddress,
      tokenId
    );
    receiverAccountUpdate.balance.addInPlace(amount);
  }
}

export class ExampleTokenUser extends SmartContract {
  @method approveSend(amount: UInt64) {
    this.balance.subInPlace(amount);
  }
}
