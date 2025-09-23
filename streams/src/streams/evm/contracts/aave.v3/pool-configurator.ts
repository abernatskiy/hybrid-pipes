import * as p from '@subsquid/evm-codec'
import { event, fun, viewFun, indexed, ContractBase } from '@subsquid/evm-abi'
import type { EventParams as EParams, FunctionArguments, FunctionReturn } from '@subsquid/evm-abi'

export const events = {
    ATokenUpgraded: event("0xa76f65411ec66a7fb6bc467432eb14767900449ae4469fa295e4441fe5e1cb73", "ATokenUpgraded(address,address,address)", {"asset": indexed(p.address), "proxy": indexed(p.address), "implementation": indexed(p.address)}),
    AssetBorrowableInEModeChanged: event("0x60087ca045be9d8d1301445e67d6248eddba97629c80284fa4910c0e52f103ab", "AssetBorrowableInEModeChanged(address,uint8,bool)", {"asset": indexed(p.address), "categoryId": p.uint8, "borrowable": p.bool}),
    AssetCollateralInEModeChanged: event("0x79409190108b26fcb0e4570f8e240f627bf18fd01a55f751010224d5bd486098", "AssetCollateralInEModeChanged(address,uint8,bool)", {"asset": indexed(p.address), "categoryId": p.uint8, "collateral": p.bool}),
    BorrowCapChanged: event("0xc51aca575985d521c5072ad11549bad77013bb786d57f30f94b40ed8f8dc9bc4", "BorrowCapChanged(address,uint256,uint256)", {"asset": indexed(p.address), "oldBorrowCap": p.uint256, "newBorrowCap": p.uint256}),
    BorrowableInIsolationChanged: event("0x74adf6aaf58c08bc4f993640385e136522375ea3d1589a10d02adbb906c67d1c", "BorrowableInIsolationChanged(address,bool)", {"asset": p.address, "borrowable": p.bool}),
    BridgeProtocolFeeUpdated: event("0x30b17cb587a89089d003457c432f73e22aeee93de425e92224ba01080260ecd9", "BridgeProtocolFeeUpdated(uint256,uint256)", {"oldBridgeProtocolFee": p.uint256, "newBridgeProtocolFee": p.uint256}),
    CollateralConfigurationChanged: event("0x637febbda9275aea2e85c0ff690444c8d87eb2e8339bbede9715abcc89cb0995", "CollateralConfigurationChanged(address,uint256,uint256,uint256)", {"asset": indexed(p.address), "ltv": p.uint256, "liquidationThreshold": p.uint256, "liquidationBonus": p.uint256}),
    DebtCeilingChanged: event("0x6824a6c7fbc10d2979b1f1ccf2dd4ed0436541679a661dedb5c10bd4be830682", "DebtCeilingChanged(address,uint256,uint256)", {"asset": indexed(p.address), "oldDebtCeiling": p.uint256, "newDebtCeiling": p.uint256}),
    EModeCategoryAdded: event("0x0acf8b4a3cace10779798a89a206a0ae73a71b63acdd3be2801d39c2ef7ab3cb", "EModeCategoryAdded(uint8,uint256,uint256,uint256,address,string)", {"categoryId": indexed(p.uint8), "ltv": p.uint256, "liquidationThreshold": p.uint256, "liquidationBonus": p.uint256, "oracle": p.address, "label": p.string}),
    FlashloanPremiumToProtocolUpdated: event("0xe7e0c75e1fc2d0bd83dc85d59f085b3e763107c392fb368e85572b292f1f5576", "FlashloanPremiumToProtocolUpdated(uint128,uint128)", {"oldFlashloanPremiumToProtocol": p.uint128, "newFlashloanPremiumToProtocol": p.uint128}),
    FlashloanPremiumTotalUpdated: event("0x71aba182c9d0529b516de7a78bed74d49c207ef7e152f52f7ea5d8730138f643", "FlashloanPremiumTotalUpdated(uint128,uint128)", {"oldFlashloanPremiumTotal": p.uint128, "newFlashloanPremiumTotal": p.uint128}),
    LiquidationGracePeriodChanged: event("0xdf4f96448786bcd6fecc9f1fa25f1fbbbee6a5c9e76d635a615ac57bb5983d10", "LiquidationGracePeriodChanged(address,uint40)", {"asset": indexed(p.address), "gracePeriodUntil": p.uint40}),
    LiquidationGracePeriodDisabled: event("0x1df36dc1651d06d990805068d22811a3a9ca4396190787ef59f9102e61868fff", "LiquidationGracePeriodDisabled(address)", {"asset": indexed(p.address)}),
    LiquidationProtocolFeeChanged: event("0xb5b0a963825337808b6e3154de8e98027595a5cad4219bb3a9bc55b192f4b391", "LiquidationProtocolFeeChanged(address,uint256,uint256)", {"asset": indexed(p.address), "oldFee": p.uint256, "newFee": p.uint256}),
    PendingLtvChanged: event("0x6a3fa1f355f7c7ab43e41cb277d1f8471f2693c63dca91049d5ec127bb588e10", "PendingLtvChanged(address,uint256)", {"asset": indexed(p.address), "ltv": p.uint256}),
    ReserveActive: event("0xc36c7d11ba01a5869d52aa4a3781939dab851cbc9ee6e7fdcedc7d58898a3f1e", "ReserveActive(address,bool)", {"asset": indexed(p.address), "active": p.bool}),
    ReserveBorrowing: event("0x2443ba28e8d1d88d531a3d90b981816a4f3b3c7f1fd4085c6029e81d1b7a570d", "ReserveBorrowing(address,bool)", {"asset": indexed(p.address), "enabled": p.bool}),
    ReserveDropped: event("0xeeec4c06f7adad215cbdb4d2960896c83c26aedce02dde76d36fa28588d62da4", "ReserveDropped(address)", {"asset": indexed(p.address)}),
    ReserveFactorChanged: event("0xb46e2b82b0c2cf3d7d9dece53635e165c53e0eaa7a44f904d61a2b7174826aef", "ReserveFactorChanged(address,uint256,uint256)", {"asset": indexed(p.address), "oldReserveFactor": p.uint256, "newReserveFactor": p.uint256}),
    ReserveFlashLoaning: event("0xc8ff3cc5b0fddaa3e6ebbbd7438f43393e4ea30e88b80ad016c1bc094655034d", "ReserveFlashLoaning(address,bool)", {"asset": indexed(p.address), "enabled": p.bool}),
    ReserveFrozen: event("0x0c4443d258a350d27dc50c378b2ebf165e6469725f786d21b30cab16823f5587", "ReserveFrozen(address,bool)", {"asset": indexed(p.address), "frozen": p.bool}),
    ReserveInitialized: event("0x3a0ca721fc364424566385a1aa271ed508cc2c0949c2272575fb3013a163a45f", "ReserveInitialized(address,address,address,address,address)", {"asset": indexed(p.address), "aToken": indexed(p.address), "stableDebtToken": p.address, "variableDebtToken": p.address, "interestRateStrategyAddress": p.address}),
    ReserveInterestRateDataChanged: event("0x1e608c2c753fede2f1f22fca4170277b53ebe5015e488a53414a8921446b7c40", "ReserveInterestRateDataChanged(address,address,bytes)", {"asset": indexed(p.address), "strategy": indexed(p.address), "data": p.bytes}),
    ReserveInterestRateStrategyChanged: event("0xdb8dada53709ce4988154324196790c2e4a60c377e1256790946f83b87db3c33", "ReserveInterestRateStrategyChanged(address,address,address)", {"asset": indexed(p.address), "oldStrategy": p.address, "newStrategy": p.address}),
    ReservePaused: event("0xe188d542a5f11925d3a3af33703cdd30a43cb3e8066a3cf68b1b57f61a5a94b5", "ReservePaused(address,bool)", {"asset": indexed(p.address), "paused": p.bool}),
    SiloedBorrowingChanged: event("0x842a280b07e8e502a9101f32a3b768ebaba3655556dd674f0831900861fc674b", "SiloedBorrowingChanged(address,bool,bool)", {"asset": indexed(p.address), "oldState": p.bool, "newState": p.bool}),
    SupplyCapChanged: event("0x0263602682188540a2d633561c0b4453b7d8566285e99f9f6018b8ef2facef49", "SupplyCapChanged(address,uint256,uint256)", {"asset": indexed(p.address), "oldSupplyCap": p.uint256, "newSupplyCap": p.uint256}),
    VariableDebtTokenUpgraded: event("0x9439658a562a5c46b1173589df89cf001483d685bad28aedaff4a88656292d81", "VariableDebtTokenUpgraded(address,address,address)", {"asset": indexed(p.address), "proxy": indexed(p.address), "implementation": indexed(p.address)}),
}
