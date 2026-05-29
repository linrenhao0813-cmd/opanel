package net.opanel.fabric_1_19.mixin;

import net.minecraft.block.BlockState;
import net.minecraft.server.world.ServerWorld;
import net.minecraft.util.math.BlockPos;
import net.minecraft.world.World;
import net.minecraft.world.chunk.WorldChunk;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;

import static net.opanel.fabric_helper.utils.FabricUtils.emitDirtyChunk;

@Mixin(WorldChunk.class)
public class WorldChunkMixin {
    @Inject(method = "setBlockState", at = @At("RETURN"))
    private void onUpdateBlockState(BlockPos pos, BlockState state, boolean moved, CallbackInfoReturnable<BlockState> cir) {
        BlockState newState = cir.getReturnValue();
        if(newState == null) return;
        if(newState == state) return;

        WorldChunk self = (WorldChunk) (Object) this;
        World world = self.getWorld();
        if(!(world instanceof ServerWorld) || world.getRegistryKey() != World.OVERWORLD) return;

        emitDirtyChunk(world, pos);
    }
}
