{
  description = "Song View - Web-based Spotify/osu! CSV viewer";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixpkgs-unstable";
    treefmt-nix.url = "github:numtide/treefmt-nix";
  };

  outputs =
    {
      nixpkgs,
      treefmt-nix,
      ...
    }:
    let
      systems = [
        "x86_64-linux"
        "aarch64-linux"
        "aarch64-darwin"
        "x86_64-darwin"
      ];
      forAllSystems = nixpkgs.lib.genAttrs systems;
      mkTreefmt = pkgs: treefmt-nix.lib.evalModule pkgs {
        projectRootFile = "flake.nix";
        settings.global.excludes = [ "flake.nix" ];
        programs = {
          nixfmt.enable = true;
          prettier.enable = true;
          biome.enable = true;
        };
      };
    in {
      formatter = forAllSystems (system:
        let pkgs = nixpkgs.legacyPackages.${system};
        in (mkTreefmt pkgs).config.build.wrapper
      );

      devShells = forAllSystems (system:
        let
          pkgs = nixpkgs.legacyPackages.${system};
          treefmt = mkTreefmt pkgs;
        in {
          default = pkgs.mkShell {
            packages = with pkgs; [
              nodejs
              wrangler
              treefmt.config.build.wrapper
            ];
          };
        }
      );
    };
}